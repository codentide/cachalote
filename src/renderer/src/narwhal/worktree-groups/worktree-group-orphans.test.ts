import { describe, expect, it } from 'vitest'
import { orphanWorktreeGroups } from './worktree-group-orphans'

const groups = {
  live: { id: 'live', name: 'Live' },
  gone: { id: 'gone', name: 'Gone' },
  bare: { id: 'bare', name: 'Bare' }
}

describe('orphanWorktreeGroups', () => {
  it('lists the groups with no member the app knows, with how many stale ids they hold', () => {
    const membership = { a: 'live', b: 'live', deletedOne: 'live', x: 'gone', y: 'gone' }
    expect(orphanWorktreeGroups({ groups, membership }, new Set(['a', 'b']))).toEqual([
      { group: groups.bare, staleMembers: 0 },
      { group: groups.gone, staleMembers: 2 }
    ])
  })
})
