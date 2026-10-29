import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  callMock,
  runtimeClientConstructorMock,
  serveOrcaAppMock,
  getDefaultUserDataPathMock,
  addEnvironmentFromPairingCodeMock,
  listEnvironmentsMock,
  spawnMock
} = vi.hoisted(() => ({
  callMock: vi.fn(),
  runtimeClientConstructorMock: vi.fn(),
  serveOrcaAppMock: vi.fn(),
  getDefaultUserDataPathMock: vi.fn(() => '/tmp/orca-user-data'),
  addEnvironmentFromPairingCodeMock: vi.fn(),
  listEnvironmentsMock: vi.fn(),
  spawnMock: vi.fn()
}))

vi.mock('../runtime-client', async () => {
  const { createRuntimeClientModuleMock } = await import('../index-test-harness.js')
  return createRuntimeClientModuleMock({
    callMock,
    runtimeClientConstructorMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock
  })
})

vi.mock('../runtime/environments', () => ({
  addEnvironmentFromPairingCode: addEnvironmentFromPairingCodeMock,
  listEnvironments: listEnvironmentsMock,
  removeEnvironment: vi.fn(),
  resolveEnvironment: vi.fn()
}))

vi.mock('child_process', async () => {
  const { createChildProcessModuleMock } = await import('../index-test-harness.js')
  return createChildProcessModuleMock(spawnMock)
})

import { main } from '../index'
import { buildWorktree, okFixture, worktreeListFixture } from '../test-fixtures'
import { useWorktreeAwarenessEnvironment } from '../index-test-harness'
import type {
  SonarSlotStatus,
  SonarStatusResult
} from '../../shared/rpc-contract/cachalote-sonar-params'

const MINE = buildWorktree('/tmp/api', 'feat')
const OTHER = buildWorktree('/tmp/other', 'other')

function slot(over: Partial<SonarSlotStatus> = {}): SonarSlotStatus {
  return {
    repoId: 'repo',
    slotId: 's1',
    label: 'web',
    port: 3000,
    phase: 'idle',
    worktreeId: null,
    startedAt: null,
    error: null,
    portOwner: null,
    url: 'http://localhost:3000',
    worktreePath: null,
    ...over
  }
}

type Script = {
  statuses?: SonarStatusResult[]
  serve?: unknown
  stop?: unknown
  logs?: unknown
  worktrees?: ReturnType<typeof buildWorktree>[]
}

function setup(script: Script) {
  const statuses = [...(script.statuses ?? [{ supported: true, slots: [slot()] }])]
  callMock.mockImplementation(async (method: string, params?: { worktree?: string }) => {
    if (method === 'worktree.list') {
      return worktreeListFixture(script.worktrees ?? [MINE])
    }
    if (method === 'worktree.show') {
      const found = [MINE, OTHER].find((w) => w.id === params?.worktree?.replace(/^id:/, ''))
      return okFixture('show', { worktree: found ?? MINE })
    }
    if (method === 'sonar.status') {
      return okFixture('status', statuses.length > 1 ? statuses.shift() : statuses[0])
    }
    if (method === 'sonar.serve') {
      return okFixture('serve', script.serve ?? { status: 'requested' })
    }
    if (method === 'sonar.stop') {
      return okFixture('stop', script.stop ?? { status: 'stopped' })
    }
    if (method === 'sonar.logs') {
      return okFixture('logs', script.logs ?? { lines: [], truncated: false, phase: 'idle' })
    }
    throw new Error(`unexpected ${method}`)
  })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
}

const out = () => vi.mocked(console.log).mock.calls.flat().join('\n')
const err = () => vi.mocked(console.error).mock.calls.flat().join('\n')
const live = (over: Partial<SonarSlotStatus> = {}) =>
  slot({ phase: 'live', worktreeId: MINE.id, worktreePath: '/tmp/api', ...over })

describe('orca sonar', () => {
  useWorktreeAwarenessEnvironment({
    callMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock,
    addEnvironmentFromPairingCodeMock,
    listEnvironmentsMock,
    spawnMock
  })
  let priorExitCode: typeof process.exitCode
  beforeEach(() => {
    priorExitCode = process.exitCode
    process.exitCode = undefined
  })
  afterEach(() => {
    process.exitCode = priorExitCode
    vi.useRealTimers()
  })

  describe('status', () => {
    it('shows the caller project slots and marks this worktree', async () => {
      setup({
        statuses: [
          {
            supported: true,
            slots: [live(), slot({ repoId: 'elsewhere', slotId: 'x', port: 4000 })]
          }
        ]
      })
      await main(['sonar', 'status'], '/tmp/api')
      expect(out()).toContain(':3000  web  live  /tmp/api  http://localhost:3000  (this worktree)')
      expect(out()).not.toContain(':4000')
    })

    it('shows every project with --all and adds callerWorktreeId in JSON', async () => {
      setup({
        statuses: [
          { supported: true, slots: [live(), slot({ repoId: 'e', slotId: 'x', port: 4000 })] }
        ]
      })
      await main(['sonar', 'status', '--all', '--json'], '/tmp/api')
      const result = JSON.parse(out()).result
      expect(result.slots).toHaveLength(2)
      expect(result.callerWorktreeId).toBe(MINE.id)
    })

    it('shows all slots when cwd is in no worktree', async () => {
      setup({
        statuses: [
          { supported: true, slots: [live(), slot({ repoId: 'e', slotId: 'x', port: 4000 })] }
        ]
      })
      await main(['sonar', 'status', '--json'], '/somewhere/else')
      const result = JSON.parse(out()).result
      expect(result.slots).toHaveLength(2)
      expect(result.callerWorktreeId).toBeNull()
    })

    it('reports an unsupported platform', async () => {
      setup({ statuses: [{ supported: false, slots: [] }] })
      await main(['sonar', 'status'], '/tmp/api')
      expect(err()).toContain('Sonar is only available on macOS.')
      expect(process.exitCode).toBe(1)
    })

    it('names the version gap when the runtime has no Sonar', async () => {
      setup({})
      const { RuntimeClientError } = await import('../runtime/types.js')
      const base = callMock.getMockImplementation()!
      callMock.mockImplementation(async (method: string, ...rest: unknown[]) => {
        if (method === 'sonar.status') {
          throw new RuntimeClientError('method_not_found', 'Unknown method: sonar.status')
        }
        return base(method, ...rest)
      })
      await main(['sonar', 'status'], '/tmp/api')
      expect(err()).toContain('This Orca build has no Sonar; update Cachalot.')
      expect(err()).not.toContain('Unknown method')
      expect(process.exitCode).toBe(1)
    })
  })

  describe('serve', () => {
    it('returns right after the request with --timeout-ms 0', async () => {
      setup({})
      await main(['sonar', 'serve', '--timeout-ms', '0'], '/tmp/api')
      expect(callMock).toHaveBeenCalledWith('sonar.serve', {
        repoId: 'repo',
        slotId: 's1',
        worktreeId: MINE.id,
        force: undefined
      })
      expect(out()).toContain('Requested :3000 for /tmp/api.')
      expect(process.exitCode).toBeUndefined()
    })

    it('waits while pending and prints the URL once live', async () => {
      vi.useFakeTimers()
      setup({
        statuses: [
          { supported: true, slots: [slot()] },
          { supported: true, slots: [live({ phase: 'syncing' })] },
          { supported: true, slots: [live({ phase: 'starting' })] },
          { supported: true, slots: [live()] }
        ]
      })
      const run = main(['sonar', 'serve'], '/tmp/api')
      await vi.advanceTimersByTimeAsync(5000)
      await run
      expect(out()).toContain('Live: http://localhost:3000 (/tmp/api)')
      expect(process.exitCode).toBeUndefined()
    })

    it('prints a JSON object with the final status', async () => {
      setup({
        statuses: [
          { supported: true, slots: [slot()] },
          { supported: true, slots: [live()] }
        ]
      })
      await main(['sonar', 'serve', '--json'], '/tmp/api')
      expect(JSON.parse(out()).result).toMatchObject({ status: 'live' })
    })

    it('reports a failed start with the port owner', async () => {
      setup({
        statuses: [
          { supported: true, slots: [slot()] },
          {
            supported: true,
            slots: [
              live({
                phase: 'port-busy',
                error: 'Port 3000 is in use',
                portOwner: { pid: 42, command: 'node server.js', cwd: '/tmp/x' }
              })
            ]
          }
        ]
      })
      await main(['sonar', 'serve'], '/tmp/api')
      expect(out()).toContain('Port 3000 is in use')
      expect(out()).toContain('pid 42, node server.js, cwd /tmp/x')
      expect(out()).toContain("Run 'orca sonar logs' to see the server output.")
      expect(process.exitCode).toBe(1)
    })

    it('times out with the phase it was stuck in', async () => {
      vi.useFakeTimers()
      setup({ statuses: [{ supported: true, slots: [live({ phase: 'starting' })] }] })
      const run = main(['sonar', 'serve', '--timeout-ms', '3000'], '/tmp/api')
      await vi.advanceTimersByTimeAsync(4000)
      await run
      expect(out()).toContain("Still starting after 3s. Run 'orca sonar logs'")
      expect(process.exitCode).toBe(1)
    })

    it('says who holds the port when it is busy', async () => {
      setup({
        statuses: [
          {
            supported: true,
            slots: [slot({ phase: 'live', worktreeId: OTHER.id, worktreePath: '/tmp/other' })]
          }
        ],
        serve: { status: 'busy', worktreeId: OTHER.id, phase: 'live' }
      })
      await main(['sonar', 'serve'], '/tmp/api')
      expect(out()).toContain(':3000 is serving /tmp/other (live). Pass --force to take it.')
      expect(process.exitCode).toBe(1)
    })

    it('passes --force and --slot through', async () => {
      setup({
        statuses: [
          { supported: true, slots: [slot(), slot({ slotId: 's2', port: 3001 })] },
          { supported: true, slots: [slot(), live({ slotId: 's2', port: 3001 })] }
        ]
      })
      await main(['sonar', 'serve', '--slot', 's2', '--force'], '/tmp/api')
      expect(callMock).toHaveBeenCalledWith(
        'sonar.serve',
        expect.objectContaining({ slotId: 's2', force: true })
      )
    })

    it('asks for --port when the project has several ports', async () => {
      setup({
        statuses: [{ supported: true, slots: [slot(), slot({ slotId: 's2', port: 3001 })] }]
      })
      await main(['sonar', 'serve'], '/tmp/api')
      expect(err()).toContain('This project has several Sonar ports (3000, 3001): pass --port.')
      expect(callMock).not.toHaveBeenCalledWith('sonar.serve', expect.anything())
    })

    it('reports a project without ports', async () => {
      setup({ statuses: [{ supported: true, slots: [] }] })
      await main(['sonar', 'serve'], '/tmp/api')
      expect(err()).toContain('This project has no Sonar ports.')
    })

    it('reports a port that matches nothing', async () => {
      setup({
        statuses: [{ supported: true, slots: [slot(), slot({ slotId: 's2', port: 3001 })] }]
      })
      await main(['sonar', 'serve', '--port', '9999'], '/tmp/api')
      expect(err()).toContain('No Sonar port matches; this project has 3000, 3001.')
    })
  })

  describe('logs', () => {
    it('prints the lines of the slot serving this worktree', async () => {
      setup({
        statuses: [{ supported: true, slots: [live(), slot({ slotId: 's2', port: 3001 })] }],
        logs: { lines: ['ready', 'GET /'], truncated: false, phase: 'live' }
      })
      await main(['sonar', 'logs', '--limit', '10'], '/tmp/api')
      expect(callMock).toHaveBeenCalledWith('sonar.logs', {
        repoId: 'repo',
        slotId: 's1',
        limit: 10
      })
      expect(out()).toBe('ready\nGET /')
    })

    it('says so when there is no output', async () => {
      setup({})
      await main(['sonar', 'logs'], '/tmp/api')
      expect(callMock).toHaveBeenCalledWith('sonar.logs', {
        repoId: 'repo',
        slotId: 's1',
        limit: 80
      })
      expect(out()).toContain('No server output for :3000.')
    })
  })

  describe('stop', () => {
    it('stops the slot serving this worktree', async () => {
      setup({ statuses: [{ supported: true, slots: [live()] }] })
      await main(['sonar', 'stop'], '/tmp/api')
      expect(callMock).toHaveBeenCalledWith('sonar.stop', {
        repoId: 'repo',
        slotId: 's1',
        worktreeId: MINE.id,
        force: undefined
      })
      expect(out()).toContain('Stopped :3000.')
    })

    it('refuses a slot held by another worktree', async () => {
      setup({
        statuses: [
          {
            supported: true,
            slots: [slot({ phase: 'live', worktreeId: OTHER.id, worktreePath: '/tmp/other' })]
          }
        ],
        stop: { status: 'busy', worktreeId: OTHER.id, phase: 'live' }
      })
      await main(['sonar', 'stop'], '/tmp/api')
      expect(out()).toContain(':3000 is serving /tmp/other (live). Pass --force to take it.')
      expect(process.exitCode).toBe(1)
    })
  })
})
