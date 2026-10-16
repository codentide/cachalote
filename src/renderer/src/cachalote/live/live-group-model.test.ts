import { describe, expect, it } from 'vitest'
import { liveSlotFixture } from './live-api-fixture'
import { planLiveGroupProjection, summarizeLiveGroup } from './live-group-model'

const app = 'repo-app::/wt/app'
const backend = 'repo-backend::/wt/backend'
const appSlot = liveSlotFixture({ repoId: 'repo-app', slotId: 'metro', port: 8081 })
const backendSlot = liveSlotFixture({ repoId: 'repo-backend', slotId: 'api', port: 8080 })

describe('summarizeLiveGroup', () => {
  it('counts members whose repo has a slot and those served live', () => {
    const slots = [
      { ...appSlot, worktreeId: app, phase: 'live' as const },
      { ...backendSlot, worktreeId: 'repo-backend::/wt/other', phase: 'live' as const }
    ]
    expect(summarizeLiveGroup([app, backend, 'repo-docs::/wt/docs'], slots)).toEqual({
      eligible: 2,
      live: 1
    })
  })

  it('does not count a member still starting', () => {
    const slots = [{ ...appSlot, worktreeId: app, phase: 'starting' as const }]
    expect(summarizeLiveGroup([app], slots)).toEqual({ eligible: 1, live: 0 })
  })

  it('has no eligible members without slots', () => {
    expect(summarizeLiveGroup([app], [])).toEqual({ eligible: 0, live: 0 })
  })

  it('ignores members with a malformed id', () => {
    expect(summarizeLiveGroup(['no-separator'], [appSlot]).eligible).toBe(0)
  })
})

describe('planLiveGroupProjection', () => {
  it('projects each member on the single slot of its repo', () => {
    expect(planLiveGroupProjection([app, backend], [appSlot, backendSlot])).toEqual({
      kind: 'ready',
      assignments: [
        { repoId: 'repo-app', slotId: 'metro', worktreeId: app },
        { repoId: 'repo-backend', slotId: 'api', worktreeId: backend }
      ]
    })
  })

  it('skips members without a slot instead of blocking the group', () => {
    const plan = planLiveGroupProjection([app, 'repo-docs::/wt/docs'], [appSlot])
    expect(plan).toEqual({
      kind: 'ready',
      assignments: [{ repoId: 'repo-app', slotId: 'metro', worktreeId: app }]
    })
  })

  it('is ambiguous when an eligible repo has several slots', () => {
    const second = liveSlotFixture({ repoId: 'repo-app', slotId: 'web', port: 3000 })
    expect(planLiveGroupProjection([app], [appSlot, second])).toEqual({ kind: 'ambiguous' })
  })

  it('is ambiguous when two members share a repo', () => {
    expect(planLiveGroupProjection([app, 'repo-app::/wt/app-2'], [appSlot])).toEqual({
      kind: 'ambiguous'
    })
  })

  it('has nothing to do when no member is eligible', () => {
    expect(planLiveGroupProjection([app], [])).toEqual({ kind: 'none' })
    expect(planLiveGroupProjection([], [appSlot])).toEqual({ kind: 'none' })
  })
})
