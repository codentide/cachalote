import { describe, expect, it } from 'vitest'
import { isStandbyArgs } from './live-input-guards'

describe('isStandbyArgs', () => {
  it('accepts a repo and worktree id', () => {
    expect(isStandbyArgs({ repoId: 'r', worktreeId: 'r::/wt' })).toBe(true)
  })

  it('rejects anything else', () => {
    for (const value of [null, 'x', [], {}, { repoId: 'r' }, { repoId: 1, worktreeId: 'w' }]) {
      expect(isStandbyArgs(value)).toBe(false)
    }
  })
})
