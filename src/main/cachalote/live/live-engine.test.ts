import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { Repo } from '../../../shared/repo-types'
import type { LiveProjectConfig } from '../../../shared/cachalote/live/live-types'
import { LiveConfigStore } from './live-config-store'
import { LiveEngine } from './live-engine'
import type { PortOwner } from './live-port-owner'
import { recoverLiveSlots } from './live-recovery'
import type { LiveRuntime } from './live-server-contract'
import type { LiveWatchCallbacks } from './live-watch'

const PORT = 47811

function git(cwd: string, ...args: string[]): void {
  execFileSync(
    'git',
    ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args],
    { cwd, encoding: 'utf8' }
  )
}

function put(root: string, relativePath: string, content: string): void {
  const absolute = path.join(root, relativePath)
  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

describe('LiveEngine', () => {
  let sandbox: string
  let main: string
  let other: string
  let home: string
  let storeFile: string
  let repo: Repo
  let repos: Repo[]
  let portOpen: boolean
  let owner: PortOwner | null
  let terminals: Awaited<ReturnType<LiveRuntime['listTerminals']>>['terminals']
  let created: number
  let runtime: LiveRuntime
  let watchers: {
    worktreePath: string
    callbacks: LiveWatchCallbacks
    stop: ReturnType<typeof vi.fn>
  }[]
  let terminate: Mock<(pid: number) => void>
  let engines: LiveEngine[]
  let platform: NodeJS.Platform

  const config = (
    overrides: Partial<LiveProjectConfig['slots'][number]> = {}
  ): LiveProjectConfig => ({
    repoId: 'r1',
    slots: [
      {
        id: 'web',
        label: 'Web',
        port: PORT,
        install: 'pnpm install',
        start: 'pnpm dev',
        depsFiles: ['package.json'],
        envFiles: ['.env*'],
        ...overrides
      }
    ]
  })

  function makeEngine(configStore = new LiveConfigStore(storeFile, 0)): LiveEngine {
    const engine = new LiveEngine({
      getRepos: () => repos,
      config: configStore,
      slotDeps: {
        server: {
          runtime,
          probe: async () => portOpen,
          resolveOwner: async () => owner,
          terminate,
          now: () => Date.now(),
          sleep: async () => {}
        },
        watch: async (worktreePath, callbacks) => {
          const entry = { worktreePath, callbacks, stop: vi.fn(async () => {}) }
          watchers.push(entry)
          return { stop: entry.stop }
        }
      },
      inspector: { resolveOwner: async () => owner, treeRssBytes: async () => 123 },
      platform,
      homeDir: home,
      emit: () => {}
    })
    engines.push(engine)
    return engine
  }

  const runnerPath = () => path.join(home, 'orca', 'live', 'demo', 'web')
  const slotState = (engine: LiveEngine) => engine.snapshot().slots[0]
  const mainId = () => `r1::${main}`
  const otherId = () => `r1::${other}`
  const settle = (engine: LiveEngine) =>
    vi.waitFor(() => expect(engine.ensureSlot('r1', 'web').queue.isBusy).toBe(false))

  beforeEach(() => {
    sandbox = mkdtempSync(path.join(tmpdir(), 'cachalote-live-engine-'))
    main = path.join(sandbox, 'demo')
    other = path.join(sandbox, 'demo-feature')
    home = path.join(sandbox, 'home')
    storeFile = path.join(sandbox, 'cachalote-live.json')
    mkdirSync(main)
    mkdirSync(home)
    git(main, 'init', '-q', '-b', 'main')
    put(main, '.gitignore', '.env\nnode_modules/\n')
    put(main, 'package.json', '{"v":1}\n')
    put(main, 'src/app.js', 'app main\n')
    put(main, 'only-main.txt', 'main\n')
    put(main, '.env', 'SECRET=1\n')
    git(main, 'add', '-A')
    git(main, 'commit', '-q', '-m', 'init')
    git(main, 'worktree', 'add', '-q', '-b', 'feature', other)
    put(other, 'src/app.js', 'app feature\n')
    rmSync(path.join(other, 'only-main.txt'))
    repo = { id: 'r1', path: main, displayName: 'demo', badgeColor: '#000', addedAt: 0 }
    repos = [repo]
    portOpen = false
    owner = null
    created = 0
    terminals = []
    watchers = []
    engines = []
    platform = 'darwin'
    terminate = vi.fn(() => {
      portOpen = false
    })
    runtime = {
      createTerminal: vi.fn(async () => {
        created += 1
        terminals.push({
          handle: `handle-${created}`,
          ptyId: `pty-${created}`,
          tabId: `tab-${created}`,
          worktreeId: mainId(),
          title: `Sonar :${PORT}`
        })
        return {
          handle: `handle-${created}`,
          worktreeId: mainId(),
          tabId: `tab-${created}`,
          ptyId: `pty-${created}`
        }
      }),
      listTerminals: vi.fn(async () => ({ terminals })),
      closeTerminal: vi.fn(async (handle: string) => {
        terminals = terminals.filter((terminal) => terminal.handle !== handle)
        portOpen = false
      }),
      focusTerminal: vi.fn(async () => undefined),
      readTerminal: vi.fn(async () => ({ tail: [], truncated: false }))
    }
  })

  afterEach(() => {
    for (const engine of engines) {
      engine.dispose()
    }
    rmSync(sandbox, { recursive: true, force: true })
  })

  it('lists configured slots as idle, and reports unsupported platforms', async () => {
    const engine = makeEngine()
    expect(engine.snapshot()).toEqual({ supported: true, slots: [] })
    expect(await engine.saveConfig(config())).toEqual({ ok: true })

    expect(slotState(engine)).toMatchObject({
      repoId: 'r1',
      slotId: 'web',
      port: PORT,
      phase: 'idle',
      worktreeId: null,
      runnerPath: runnerPath()
    })

    platform = 'linux'
    const unsupported = makeEngine()
    expect(unsupported.snapshot()).toEqual({ supported: false, slots: [] })
    await expect(
      unsupported.project({ repoId: 'r1', slotId: 'web', worktreeId: mainId() })
    ).rejects.toThrow(/macOS/)
  })

  it('serves a worktree: syncs the runner, links env files and starts one server', async () => {
    const engine = makeEngine()
    await engine.saveConfig(config())

    await engine.project({ repoId: 'r1', slotId: 'web', worktreeId: mainId() })
    await settle(engine)

    expect(readFileSync(path.join(runnerPath(), 'src/app.js'), 'utf8')).toBe('app main\n')
    expect(readlinkSync(path.join(runnerPath(), '.env'))).toBe(path.join(main, '.env'))
    expect(runtime.createTerminal).toHaveBeenCalledTimes(1)
    expect(runtime.createTerminal).toHaveBeenCalledWith(`id:${mainId()}`, {
      cwd: runnerPath(),
      command: 'HUSKY=0 pnpm install && pnpm dev',
      title: `Sonar :${PORT}`,
      presentation: 'background'
    })
    expect(slotState(engine)).toMatchObject({
      phase: 'starting',
      worktreeId: mainId(),
      terminal: { tabId: 'tab-1', ptyId: 'pty-1' }
    })
    expect(watchers.map((watcher) => watcher.worktreePath)).toEqual([main])
  })

  it('switches worktrees without restarting the server and copies only the difference', async () => {
    const engine = makeEngine()
    await engine.saveConfig(config())
    await engine.project({ repoId: 'r1', slotId: 'web', worktreeId: mainId() })
    await settle(engine)
    const inodeBefore = lstatSync(path.join(runnerPath(), 'package.json')).ino

    await engine.project({ repoId: 'r1', slotId: 'web', worktreeId: otherId() })
    await settle(engine)

    expect(readFileSync(path.join(runnerPath(), 'src/app.js'), 'utf8')).toBe('app feature\n')
    expect(existsSync(path.join(runnerPath(), 'only-main.txt'))).toBe(false)
    expect(lstatSync(path.join(runnerPath(), 'package.json')).ino).toBe(inodeBefore)
    expect(runtime.createTerminal).toHaveBeenCalledTimes(1)
    expect(runtime.closeTerminal).not.toHaveBeenCalled()
    expect(slotState(engine)).toMatchObject({ worktreeId: otherId(), phase: 'starting' })
    expect(watchers.map((watcher) => watcher.worktreePath)).toEqual([main, other])
    expect(watchers[0]?.stop).toHaveBeenCalled()
  })

  it('restarts with an install when a dependency file differs', async () => {
    const engine = makeEngine()
    await engine.saveConfig(config())
    await engine.project({ repoId: 'r1', slotId: 'web', worktreeId: mainId() })
    await settle(engine)
    put(other, 'package.json', '{"v":2}\n')

    await engine.project({ repoId: 'r1', slotId: 'web', worktreeId: otherId() })
    await settle(engine)

    expect(runtime.closeTerminal).toHaveBeenCalledTimes(1)
    expect(runtime.createTerminal).toHaveBeenCalledTimes(2)
  })

  it('applies watcher events to the runner and restarts when a dependency file changes', async () => {
    const engine = makeEngine()
    await engine.saveConfig(config())
    await engine.project({ repoId: 'r1', slotId: 'web', worktreeId: mainId() })
    await settle(engine)
    const watcher = watchers[0]
    if (!watcher) {
      throw new Error('no watcher')
    }

    put(main, 'src/app.js', 'app edited\n')
    watcher.callbacks.onEvents(new Map([['src/app.js', 'change']]))
    await vi.waitFor(() =>
      expect(readFileSync(path.join(runnerPath(), 'src/app.js'), 'utf8')).toBe('app edited\n')
    )
    expect(runtime.createTerminal).toHaveBeenCalledTimes(1)

    put(main, 'package.json', '{"v":3}\n')
    watcher.callbacks.onEvents(new Map([['package.json', 'change']]))
    await vi.waitFor(() => expect(runtime.createTerminal).toHaveBeenCalledTimes(2))

    put(main, 'late.txt', 'late\n')
    watcher.callbacks.onResync()
    await vi.waitFor(() => expect(existsSync(path.join(runnerPath(), 'late.txt'))).toBe(true))
  })

  it('stops: closes the terminal, drops the watch and keeps the runner and manifest', async () => {
    const store = new LiveConfigStore(storeFile, 0)
    const engine = makeEngine(store)
    await engine.saveConfig(config())
    await engine.project({ repoId: 'r1', slotId: 'web', worktreeId: mainId() })
    await settle(engine)

    await engine.stop({ repoId: 'r1', slotId: 'web' })
    await store.flush()

    expect(runtime.closeTerminal).toHaveBeenCalledWith('handle-1')
    expect(slotState(engine)).toMatchObject({ phase: 'idle', worktreeId: null, terminal: null })
    expect(watchers[0]?.stop).toHaveBeenCalled()
    expect(existsSync(path.join(runnerPath(), 'src/app.js'))).toBe(true)
    const saved = JSON.parse(readFileSync(storeFile, 'utf8').toString())
    expect(saved.slots['r1::web'].worktreeId).toBeNull()
    expect(Object.keys(saved.slots['r1::web'].manifest)).toContain('src/app.js')
  })

  it('stops a slot whose port changes in a saved config', async () => {
    const engine = makeEngine()
    await engine.saveConfig(config())
    await engine.project({ repoId: 'r1', slotId: 'web', worktreeId: mainId() })
    await settle(engine)

    expect(await engine.saveConfig(config({ label: 'Renamed' }))).toEqual({ ok: true })
    expect(slotState(engine)?.worktreeId).toBe(mainId())

    await engine.saveConfig(config({ port: PORT + 1 }))

    expect(runtime.closeTerminal).toHaveBeenCalledTimes(1)
    expect(slotState(engine)).toMatchObject({ phase: 'idle', port: PORT + 1, worktreeId: null })
  })

  it('lets projects share a port and hands it to the one served last', async () => {
    const second: Repo = { ...repo, id: 'r2', displayName: 'demo-two', path: other }
    repos = [repo, second]
    const engine = makeEngine()
    await engine.saveConfig(config())
    expect(await engine.saveConfig({ ...config(), repoId: 'r2' })).toEqual({ ok: true })
    await engine.project({ repoId: 'r1', slotId: 'web', worktreeId: mainId() })
    await settle(engine)

    await engine.project({ repoId: 'r2', slotId: 'web', worktreeId: `r2::${other}` })
    await vi.waitFor(() => expect(engine.ensureSlot('r2', 'web').queue.isBusy).toBe(false))

    const byRepo = (repoId: string) => engine.snapshot().slots.find((s) => s.repoId === repoId)
    expect(runtime.closeTerminal).toHaveBeenCalledTimes(1)
    expect(byRepo('r1')).toMatchObject({ phase: 'idle', worktreeId: null })
    expect(byRepo('r2')?.worktreeId).toBe(`r2::${other}`)
  })

  it('rejects a worktree of another repository', async () => {
    const engine = makeEngine()
    await engine.saveConfig(config())

    const stranger = path.join(sandbox, 'stranger')
    mkdirSync(stranger)
    git(stranger, 'init', '-q', '-b', 'main')
    await expect(
      engine.project({ repoId: 'r1', slotId: 'web', worktreeId: `r1::${stranger}` })
    ).rejects.toThrow(/does not belong/)
    await expect(
      engine.project({ repoId: 'r1', slotId: 'web', worktreeId: `other::${main}` })
    ).rejects.toThrow()
  })

  it('reports port-busy and frees it only for the exact process it recorded', async () => {
    const engine = makeEngine()
    await engine.saveConfig(config())
    portOpen = true
    owner = { pid: 4242, command: 'node other.js', cwd: '/elsewhere' }

    await engine.project({ repoId: 'r1', slotId: 'web', worktreeId: mainId() })
    await settle(engine)

    expect(runtime.createTerminal).not.toHaveBeenCalled()
    expect(slotState(engine)).toMatchObject({ phase: 'port-busy', portOwner: { pid: 4242 } })

    await expect(engine.freePort({ port: PORT, pid: 1 })).rejects.toThrow(/not reported/)
    owner = { pid: 4242, command: 'node other.js', cwd: '/changed' }
    await expect(engine.freePort({ port: PORT, pid: 4242 })).rejects.toThrow(/changed/)
    expect(terminate).not.toHaveBeenCalled()

    owner = { pid: 4242, command: 'node other.js', cwd: '/elsewhere' }
    await engine.freePort({ port: PORT, pid: 4242 })

    expect(terminate).toHaveBeenCalledWith(4242)
    await vi.waitFor(() => expect(runtime.createTerminal).toHaveBeenCalledTimes(1))
    await expect(engine.freePort({ port: PORT, pid: process.pid })).rejects.toThrow()
  })

  it('re-attaches a slot that was live before a restart', async () => {
    const firstStore = new LiveConfigStore(storeFile, 0)
    const first = makeEngine(firstStore)
    await first.saveConfig(config())
    await first.project({ repoId: 'r1', slotId: 'web', worktreeId: mainId() })
    await settle(first)
    first.dispose()
    portOpen = true
    put(main, 'edited-while-closed.txt', 'x\n')
    await firstStore.flush()

    const second = makeEngine(new LiveConfigStore(storeFile, 0))
    const recoverable = second.adoptPersistedSlots()
    expect(slotState(second)).toMatchObject({ phase: 'syncing', worktreeId: mainId() })
    await recoverLiveSlots(recoverable, runtime, async () => {})
    await settle(second)

    expect(slotState(second)).toMatchObject({
      phase: 'live',
      worktreeId: mainId(),
      terminal: { ptyId: 'pty-1' }
    })
    expect(existsSync(path.join(runnerPath(), 'edited-while-closed.txt'))).toBe(true)
    expect(watchers.at(-1)?.worktreePath).toBe(main)
    expect(runtime.createTerminal).toHaveBeenCalledTimes(1)
  })

  it('marks a recovered slot crashed when neither terminal nor port is there', async () => {
    const firstStore = new LiveConfigStore(storeFile, 0)
    const first = makeEngine(firstStore)
    await first.saveConfig(config())
    await first.project({ repoId: 'r1', slotId: 'web', worktreeId: mainId() })
    await settle(first)
    first.dispose()
    terminals = []
    portOpen = false
    await firstStore.flush()

    const second = makeEngine(new LiveConfigStore(storeFile, 0))
    await recoverLiveSlots(second.adoptPersistedSlots(), runtime, async () => {})
    await settle(second)

    expect(slotState(second)).toMatchObject({ phase: 'crashed', worktreeId: mainId() })
  })

  it('lets a request made during the recovery wait win, and stops a pending recovery cleanly', async () => {
    const firstStore = new LiveConfigStore(storeFile, 0)
    const first = makeEngine(firstStore)
    await first.saveConfig(config())
    await first.project({ repoId: 'r1', slotId: 'web', worktreeId: mainId() })
    await settle(first)
    first.dispose()
    portOpen = true
    owner = { pid: 77, command: 'pnpm dev', cwd: runnerPath() }
    await firstStore.flush()

    const secondStore = new LiveConfigStore(storeFile, 0)
    const second = makeEngine(secondStore)
    const recoverable = second.adoptPersistedSlots()
    await second.project({ repoId: 'r1', slotId: 'web', worktreeId: otherId() })
    await settle(second)
    await recoverLiveSlots(recoverable, runtime, async () => {})
    await settle(second)

    expect(slotState(second)).toMatchObject({ worktreeId: otherId() })
    expect(readFileSync(path.join(runnerPath(), 'src/app.js'), 'utf8')).toBe('app feature\n')

    await secondStore.flush()
    const third = makeEngine(new LiveConfigStore(storeFile, 0))
    third.adoptPersistedSlots()
    await third.stop({ repoId: 'r1', slotId: 'web' })

    expect(runtime.closeTerminal).toHaveBeenCalled()
    expect(slotState(third)).toMatchObject({ phase: 'idle', worktreeId: null })
  })

  it('reports memory use on demand', async () => {
    const engine = makeEngine()
    await engine.saveConfig(config())

    expect(await engine.usage({ repoId: 'r1', slotId: 'web' })).toEqual({ rssBytes: 123 })
  })
})
