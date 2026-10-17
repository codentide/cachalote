import '../../runtime/rpc/unused-default-rpc-methods.test-fixture'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RpcDispatcher } from '../../runtime/rpc/dispatcher'
import type { RpcRequest } from '../../runtime/rpc/core'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { LiveSlotState } from '../../../shared/cachalote/live/live-types'
import { setLiveEngine, type SonarEngine } from './live-engine-ref'
import { SONAR_METHODS } from './live-rpc-methods'

const REPO = 'repo-1'
const MINE = `${REPO}::/code/app-mine`
const OTHER = `${REPO}::/code/app-other`

function slotState(overrides: Partial<LiveSlotState> = {}): LiveSlotState {
  return {
    repoId: REPO,
    slotId: 'web',
    label: 'Web',
    port: 3000,
    worktreeId: null,
    runnerPath: '/home/orca/live/app/web',
    phase: 'idle',
    startedAt: null,
    error: null,
    terminal: { worktreeId: OTHER, tabId: 'tab-1', ptyId: 'pty-1' },
    portOwner: null,
    ...overrides
  }
}

function setup(slot: LiveSlotState = slotState()) {
  const engine = {
    snapshot: vi.fn(() => ({ supported: true, slots: [slot] })),
    project: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    readLogs: vi.fn(async () => ({ lines: ['a'], truncated: false, phase: slot.phase }))
  } satisfies SonarEngine
  setLiveEngine(engine)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: sonar methods never touch the runtime.
  const runtime = { getRuntimeId: () => 'test-runtime' } as unknown as OrcaRuntimeService
  const dispatcher = new RpcDispatcher({ runtime, methods: SONAR_METHODS })
  const call = (method: string, params?: unknown) => {
    const request: RpcRequest = { id: 'req-1', authToken: 'tok', method, params }
    return dispatcher.dispatch(request)
  }
  return { engine, call }
}

const ids = { repoId: REPO, slotId: 'web' }

afterEach(() => {
  setLiveEngine(null)
})

describe('sonar.status', () => {
  it('maps slots with url and worktree path, without internals', async () => {
    const { call } = setup(slotState({ worktreeId: MINE, phase: 'live', startedAt: 5 }))
    const response = await call('sonar.status')
    expect(response).toMatchObject({
      ok: true,
      result: {
        supported: true,
        slots: [
          {
            repoId: REPO,
            slotId: 'web',
            port: 3000,
            phase: 'live',
            worktreeId: MINE,
            startedAt: 5,
            url: 'http://localhost:3000',
            worktreePath: '/code/app-mine'
          }
        ]
      }
    })
    const wire = JSON.stringify(response)
    expect(wire).not.toContain('"terminal"')
    expect(wire).not.toContain('runnerPath')
  })

  it('reports a null path for an idle slot', async () => {
    const { call } = setup()
    expect(await call('sonar.status')).toMatchObject({
      ok: true,
      result: { slots: [{ worktreePath: null }] }
    })
  })
})

describe('sonar.serve', () => {
  it('returns busy without projecting when another worktree is live', async () => {
    const { engine, call } = setup(slotState({ worktreeId: OTHER, phase: 'live' }))
    const response = await call('sonar.serve', { ...ids, worktreeId: MINE })
    expect(response).toMatchObject({
      ok: true,
      result: { status: 'busy', worktreeId: OTHER, phase: 'live' }
    })
    expect(engine.project).not.toHaveBeenCalled()
  })

  it('projects over another worktree with force', async () => {
    const { engine, call } = setup(slotState({ worktreeId: OTHER, phase: 'live' }))
    const response = await call('sonar.serve', { ...ids, worktreeId: MINE, force: true })
    expect(response).toMatchObject({ ok: true, result: { status: 'requested' } })
    expect(engine.project).toHaveBeenCalledWith({ ...ids, worktreeId: MINE })
  })

  it('projects on an idle slot', async () => {
    const { engine, call } = setup()
    await call('sonar.serve', { ...ids, worktreeId: MINE })
    expect(engine.project).toHaveBeenCalledTimes(1)
  })

  it('projects when the slot already serves the caller', async () => {
    const { engine, call } = setup(slotState({ worktreeId: MINE, phase: 'live' }))
    await call('sonar.serve', { ...ids, worktreeId: MINE })
    expect(engine.project).toHaveBeenCalledTimes(1)
  })

  it('propagates engine errors as runtime_error', async () => {
    const { engine, call } = setup()
    engine.project.mockRejectedValue(new Error('not eligible'))
    expect(await call('sonar.serve', { ...ids, worktreeId: MINE })).toMatchObject({
      ok: false,
      error: { code: 'runtime_error', message: 'not eligible' }
    })
  })
})

describe('sonar.stop', () => {
  it('returns busy when the slot serves another worktree', async () => {
    const { engine, call } = setup(slotState({ worktreeId: OTHER, phase: 'live' }))
    const response = await call('sonar.stop', { ...ids, worktreeId: MINE })
    expect(response).toMatchObject({ ok: true, result: { status: 'busy', worktreeId: OTHER } })
    expect(engine.stop).not.toHaveBeenCalled()
  })

  it('treats a missing caller worktree as another worktree', async () => {
    const { engine, call } = setup(slotState({ worktreeId: OTHER, phase: 'live' }))
    expect(await call('sonar.stop', ids)).toMatchObject({ ok: true, result: { status: 'busy' } })
    expect(engine.stop).not.toHaveBeenCalled()
  })

  it('stops the caller slot and honours force', async () => {
    const { engine, call } = setup(slotState({ worktreeId: OTHER, phase: 'live' }))
    expect(await call('sonar.stop', { ...ids, worktreeId: OTHER })).toMatchObject({
      ok: true,
      result: { status: 'stopped' }
    })
    await call('sonar.stop', { ...ids, worktreeId: MINE, force: true })
    expect(engine.stop).toHaveBeenCalledTimes(2)
    expect(engine.stop).toHaveBeenCalledWith(ids)
  })
})

describe('sonar.logs', () => {
  it('defaults to 80 lines', async () => {
    const { engine, call } = setup()
    expect(await call('sonar.logs', ids)).toMatchObject({ ok: true, result: { lines: ['a'] } })
    expect(engine.readLogs).toHaveBeenCalledWith(ids, 80)
  })

  it('passes an explicit limit', async () => {
    const { engine, call } = setup()
    await call('sonar.logs', { ...ids, limit: 5 })
    expect(engine.readLogs).toHaveBeenCalledWith(ids, 5)
  })
})

describe('sonar errors', () => {
  it('reports a missing engine', async () => {
    const { call } = setup()
    setLiveEngine(null)
    expect(await call('sonar.status')).toMatchObject({
      ok: false,
      error: { code: 'runtime_error', message: 'Sonar is not available in this Orca runtime.' }
    })
  })

  it('rejects a missing repoId', async () => {
    const { call } = setup()
    expect(await call('sonar.logs', { slotId: 'web' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_argument' }
    })
  })
})
