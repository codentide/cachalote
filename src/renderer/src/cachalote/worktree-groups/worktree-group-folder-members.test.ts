import { describe, expect, it } from 'vitest'
import { folderMemberIds } from './worktree-group-folder-members'

describe('folderMemberIds', () => {
  it('collects the worktrees of every group folder row and nothing else', () => {
    const rows = [
      { type: 'header' },
      { type: 'cachalote-worktree-group', worktreeIds: ['app', 'backend'] },
      { type: 'item' },
      { type: 'cachalote-worktree-group', worktreeIds: ['web'] }
    ]
    expect([...folderMemberIds(rows)].sort()).toEqual(['app', 'backend', 'web'])
  })
})
