// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLiveApiFixture, liveSlotFixture } from './live-api-fixture'
import { liveActions, startLiveStore, stopLiveStore, useLiveStore } from './live-store'

let fixture: ReturnType<typeof createLiveApiFixture>

function installApi(initial?: Parameters<typeof createLiveApiFixture>[0]): void {
  fixture = createLiveApiFixture(initial)
  Object.defineProperty(window, 'api', {
    value: { cachaloteLive: fixture.api },
    configurable: true
  })
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  stopLiveStore()
})

afterEach(() => {
  stopLiveStore()
  Reflect.deleteProperty(window, 'api')
})

describe('live store', () => {
  it('loads the snapshot once and indexes it by worktree and repo', async () => {
    const slot = liveSlotFixture({ worktreeId: 'repo-1::/wt/a', phase: 'live' })
    installApi({ snapshot: { supported: true, slots: [slot] } })
    startLiveStore()
    startLiveStore()
    await flush()

    const state = useLiveStore.getState()
    expect(state.supported).toBe(true)
    expect(state.byWorktree['repo-1::/wt/a']).toEqual([slot])
    expect(state.byRepo['repo-1']).toEqual([slot])
    expect(fixture.calls.filter((call) => call.method === 'snapshot')).toHaveLength(1)
  })

  it('follows pushed snapshots', async () => {
    installApi({ snapshot: { supported: true, slots: [liveSlotFixture()] } })
    startLiveStore()
    await flush()

    const serving = liveSlotFixture({ worktreeId: 'repo-1::/wt/b', phase: 'starting' })
    fixture.emit({ supported: true, slots: [serving] })
    expect(useLiveStore.getState().byWorktree['repo-1::/wt/b']).toEqual([serving])

    fixture.emit({ supported: true, slots: [liveSlotFixture()] })
    expect(useLiveStore.getState().byWorktree['repo-1::/wt/b']).toBeUndefined()
  })

  it('shows nothing where the feature is off', async () => {
    installApi({ snapshot: { supported: false, slots: [liveSlotFixture()] } })
    startLiveStore()
    await flush()
    expect(useLiveStore.getState().supported).toBe(false)
    expect(useLiveStore.getState().slots).toEqual([])
  })

  it('does nothing without the preload api', () => {
    Reflect.deleteProperty(window, 'api')
    expect(() => startLiveStore()).not.toThrow()
    expect(useLiveStore.getState().supported).toBe(false)
  })

  it('forwards actions to the api', async () => {
    installApi()
    await liveActions.project({ repoId: 'repo-1', slotId: 'web', worktreeId: 'repo-1::/wt/a' })
    await liveActions.stop({ repoId: 'repo-1', slotId: 'web' })
    await liveActions.freePort({ port: 3000, pid: 42 })
    expect(await liveActions.usage({ repoId: 'repo-1', slotId: 'web' })).toBe(512 * 1024 * 1024)
    expect(fixture.calls.map((call) => call.method)).toEqual([
      'project',
      'stop',
      'freePort',
      'usage'
    ])
    expect(fixture.calls[2]?.args).toEqual({ port: 3000, pid: 42 })
  })
})
