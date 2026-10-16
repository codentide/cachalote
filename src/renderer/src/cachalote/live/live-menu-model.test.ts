import { describe, expect, it } from 'vitest'
import { liveSlotFixture } from './live-api-fixture'
import { decideLiveMenu } from './live-menu-model'

const target = { id: 'repo-1::/wt/a', repoId: 'repo-1' }
const api = liveSlotFixture({ slotId: 'api', port: 8080 })
const web = liveSlotFixture({ slotId: 'web', port: 3000 })

describe('decideLiveMenu', () => {
  it('hides the menu without exactly one target', () => {
    expect(decideLiveMenu([], [api])).toBeNull()
    expect(decideLiveMenu([target, { id: 'repo-1::/wt/b', repoId: 'repo-1' }], [api])).toBeNull()
  })

  it('hides the menu when the repo has no slots', () => {
    expect(decideLiveMenu([target], [liveSlotFixture({ repoId: 'repo-2' })])).toBeNull()
    expect(decideLiveMenu([target], [])).toBeNull()
  })

  it('offers the only slot of the repo', () => {
    expect(decideLiveMenu([target], [api])).toEqual({ serving: [], projectable: [api] })
  })

  it('offers every slot of the repo and ignores other repos', () => {
    const other = liveSlotFixture({ repoId: 'repo-2', slotId: 'x' })
    expect(decideLiveMenu([target], [api, web, other])?.projectable).toEqual([api, web])
  })

  it('offers to stop a slot already serving the target and not to project on it again', () => {
    const serving = { ...api, worktreeId: target.id, phase: 'live' as const }
    expect(decideLiveMenu([target], [serving, web])).toEqual({
      serving: [serving],
      projectable: [web]
    })
  })

  it('lets a slot serving another worktree be taken over', () => {
    const busy = { ...api, worktreeId: 'repo-1::/wt/other', phase: 'live' as const }
    expect(decideLiveMenu([target], [busy])).toEqual({ serving: [], projectable: [busy] })
  })
})
