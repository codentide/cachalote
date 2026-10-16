import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortOwner } from './live-port-owner'
import { buildServerCommand, LiveSlotServer } from './live-server'
import type { LiveRuntime, LiveServerDeps, ServerState } from './live-server-contract'

const RUNNER = '/runners/app/web'
const PORT = 47811
const SELECTOR = 'id:repo::/code/app'

type Terminals = Awaited<ReturnType<LiveRuntime['listTerminals']>>['terminals']

function setup(options: { install?: string } = {}) {
  const portOpen = { value: false }
  const owner: { value: PortOwner | null } = { value: null }
  const terminals: { value: Terminals | 'throw' } = { value: [] }
  const runtime = {
    createTerminal: vi.fn<LiveRuntime['createTerminal']>(async () => ({
      handle: 'handle-1',
      worktreeId: 'repo::/code/app',
      tabId: 'tab-1',
      ptyId: 'pty-1'
    })),
    listTerminals: vi.fn(async () => {
      if (terminals.value === 'throw') {
        throw new Error('runtime_unavailable')
      }
      return { terminals: terminals.value }
    }),
    closeTerminal: vi.fn(async () => {
      portOpen.value = false
    }),
    focusTerminal: vi.fn(async () => undefined)
  } satisfies LiveRuntime
  const terminate = vi.fn((_pid: number) => {
    portOpen.value = false
  })
  const deps: LiveServerDeps = {
    runtime,
    probe: async () => portOpen.value,
    resolveOwner: async () => owner.value,
    terminate,
    now: () => Date.now(),
    sleep: async () => {}
  }
  const changes: ServerState[] = []
  const server: LiveSlotServer = new LiveSlotServer(
    deps,
    () => ({ port: PORT, runnerPath: RUNNER, terminalSelector: SELECTOR }),
    () => changes.push(server.getState())
  )
  const command = buildServerCommand(options.install ?? 'pnpm install', 'pnpm dev')
  return { server, runtime, terminate, portOpen, owner, terminals, command, changes }
}

const listed = (overrides: Partial<Terminals[number]> = {}): Terminals[number] => ({
  handle: 'fresh-handle',
  ptyId: 'pty-1',
  tabId: 'tab-1',
  worktreeId: 'repo::/code/app',
  title: `Sonar :${PORT}`,
  ...overrides
})

describe('buildServerCommand', () => {
  it('chains install and start with husky off, or runs start alone', () => {
    expect(buildServerCommand('pnpm install', 'pnpm dev')).toBe('HUSKY=0 pnpm install && pnpm dev')
    expect(buildServerCommand('  ', ' pnpm dev ')).toBe('pnpm dev')
  })
})

describe('LiveSlotServer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('goes starting -> live once the port answers', async () => {
    const { server, runtime, portOpen, command } = setup()

    await server.start(command)

    expect(runtime.createTerminal).toHaveBeenCalledWith(SELECTOR, {
      cwd: RUNNER,
      command: 'HUSKY=0 pnpm install && pnpm dev',
      title: `Sonar :${PORT}`,
      presentation: 'background'
    })
    expect(server.getState()).toMatchObject({
      phase: 'starting',
      terminal: { worktreeId: 'repo::/code/app', tabId: 'tab-1', ptyId: 'pty-1' }
    })

    await vi.advanceTimersByTimeAsync(3_000)
    expect(server.getState().phase).toBe('starting')

    portOpen.value = true
    await vi.advanceTimersByTimeAsync(1_000)
    expect(server.getState().phase).toBe('live')
    server.dispose()
  })

  it('gives up on a start that never opens the port after ten minutes', async () => {
    const { server, command } = setup()
    await server.start(command)

    await vi.advanceTimersByTimeAsync(9 * 60_000)
    expect(server.getState().phase).toBe('starting')
    await vi.advanceTimersByTimeAsync(61_000)

    expect(server.getState().phase).toBe('crashed')
    server.dispose()
  })

  it('is crashed only after two failed probes in a row, and heals when the port returns', async () => {
    const { server, portOpen, command } = setup()
    portOpen.value = false
    await server.start(command)
    portOpen.value = true
    await vi.advanceTimersByTimeAsync(1_000)
    expect(server.getState().phase).toBe('live')

    portOpen.value = false
    await vi.advanceTimersByTimeAsync(30_000)
    expect(server.getState().phase).toBe('live')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(server.getState().phase).toBe('crashed')

    portOpen.value = true
    await vi.advanceTimersByTimeAsync(30_000)
    expect(server.getState().phase).toBe('live')
    server.dispose()
  })

  it('one missed probe between two good ones does not count', async () => {
    const { server, portOpen, command } = setup()
    await server.start(command)
    portOpen.value = true
    await vi.advanceTimersByTimeAsync(1_000)

    portOpen.value = false
    await vi.advanceTimersByTimeAsync(30_000)
    portOpen.value = true
    await vi.advanceTimersByTimeAsync(30_000)
    portOpen.value = false
    await vi.advanceTimersByTimeAsync(30_000)

    expect(server.getState().phase).toBe('live')
    server.dispose()
  })

  it('reports port-busy with the owner when a foreign process holds the port', async () => {
    const { server, runtime, portOpen, owner, command } = setup()
    portOpen.value = true
    owner.value = { pid: 4242, command: 'node other.js', cwd: '/somewhere/else' }

    await server.start(command)

    expect(runtime.createTerminal).not.toHaveBeenCalled()
    expect(server.getState()).toMatchObject({
      phase: 'port-busy',
      portOwner: { pid: 4242, command: 'node other.js', cwd: '/somewhere/else' }
    })
  })

  it('adopts a listener that already lives in the runner instead of starting another', async () => {
    const { server, runtime, portOpen, owner, command } = setup()
    portOpen.value = true
    owner.value = { pid: 7, command: 'next dev', cwd: RUNNER }

    await server.start(command)

    expect(runtime.createTerminal).not.toHaveBeenCalled()
    expect(server.getState().phase).toBe('live')
    server.dispose()
  })

  it('is crashed with the reason when the terminal cannot be created', async () => {
    const { server, runtime, command } = setup()
    runtime.createTerminal.mockRejectedValueOnce(new Error('runtime_unavailable\nstack...'))

    await server.start(command)

    expect(server.getState()).toMatchObject({ phase: 'crashed', error: 'runtime_unavailable' })
  })

  it('stops through a fresh handle looked up by pty id', async () => {
    const { server, runtime, portOpen, terminals, command } = setup()
    await server.start(command)
    portOpen.value = true
    terminals.value = [listed({ handle: 'other', ptyId: 'pty-9', title: 'zsh' }), listed()]

    await server.stop()

    expect(runtime.closeTerminal).toHaveBeenCalledTimes(1)
    expect(runtime.closeTerminal).toHaveBeenCalledWith('fresh-handle')
    expect(server.getState()).toMatchObject({ phase: 'idle', terminal: null, startedAt: null })
  })

  it('falls back to the title when the pty id is unknown', async () => {
    const { server, runtime, terminals, command } = setup()
    runtime.createTerminal.mockResolvedValueOnce({
      handle: 'h',
      worktreeId: 'repo::/code/app',
      tabId: 'tab-1',
      ptyId: null
    })
    await server.start(command)
    terminals.value = [listed({ ptyId: 'pty-77' })]

    await server.stop()

    expect(runtime.closeTerminal).toHaveBeenCalledWith('fresh-handle')
  })

  it('stop last-resorts a SIGTERM on a listener in the runner when the terminal lookup fails', async () => {
    const { server, runtime, portOpen, owner, terminals, terminate, command } = setup()
    await server.start(command)
    portOpen.value = true
    terminals.value = 'throw'
    owner.value = { pid: 555, command: 'next-server', cwd: RUNNER }

    await server.stop()

    expect(runtime.closeTerminal).not.toHaveBeenCalled()
    expect(terminate).toHaveBeenCalledWith(555)
    expect(server.getState().phase).toBe('idle')
  })

  it('never signals a listener whose cwd is outside the runner', async () => {
    const { server, portOpen, owner, terminals, terminate, command } = setup()
    await server.start(command)
    portOpen.value = true
    terminals.value = []
    owner.value = { pid: 556, command: 'node', cwd: '/elsewhere' }

    await server.stop()

    expect(terminate).not.toHaveBeenCalled()
    expect(server.getState().phase).toBe('idle')
  })

  it('does not wait or signal when stopping a slot that never started', async () => {
    const { server, runtime, portOpen, terminate } = setup()
    portOpen.value = true

    await server.stop()

    expect(runtime.listTerminals).not.toHaveBeenCalled()
    expect(terminate).not.toHaveBeenCalled()
  })

  it('focuses the terminal by a fresh handle and fails when it is gone', async () => {
    const { server, runtime, terminals, command } = setup()
    await server.start(command)
    terminals.value = [listed()]

    await server.focusTerminal()
    expect(runtime.focusTerminal).toHaveBeenCalledWith('fresh-handle')

    terminals.value = []
    await expect(server.focusTerminal()).rejects.toThrow(/no longer open/)
    server.dispose()
  })

  describe('restore', () => {
    const persisted = { worktreeId: 'repo::/code/app', tabId: 'tab-1', ptyId: 'pty-1' }

    it('is live when the terminal exists and the port answers', async () => {
      const { server, terminals, portOpen } = setup()
      terminals.value = [listed()]
      portOpen.value = true

      await server.restore(persisted, 1_000)

      expect(server.getState()).toMatchObject({ phase: 'live', startedAt: 1_000 })
      server.dispose()
    })

    it('is crashed when neither the terminal nor the port is there', async () => {
      const { server } = setup()

      await server.restore(persisted, 1_000)

      expect(server.getState()).toMatchObject({ phase: 'crashed', terminal: null })
      server.dispose()
    })

    it('keeps waiting when the terminal is there but the port is still closed', async () => {
      const { server, terminals } = setup()
      terminals.value = [listed()]

      await server.restore(persisted, Date.now())

      expect(server.getState().phase).toBe('starting')
      server.dispose()
    })

    it('does not trust an open port held by a foreign process when the terminal is gone', async () => {
      const { server, portOpen, owner } = setup()
      portOpen.value = true
      owner.value = { pid: 9, command: 'python', cwd: '/other' }

      await server.restore(persisted, 1_000)

      expect(server.getState()).toMatchObject({ phase: 'port-busy' })
    })
  })
})
