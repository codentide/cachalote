import { describe, expect, it } from 'vitest'
import type { Worktree } from '../../../../shared/worktree/types'
import type { Row, WorktreeRow } from '../../components/sidebar/worktree-list/grouping/row-types'
import { appendWorktreeGroupRows } from './worktree-group-rows'
import type { WorktreeGroupsView } from './worktree-groups-store'

function worktree(id: string, repoId = 'repo-a'): Worktree {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the builder reads only id and repoId.
  return { id, repoId } as Worktree
}

function memberRow(item: Worktree, isLast: boolean): WorktreeRow {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: tests assert only these fields.
  return { type: 'item', worktree: item, depth: 1, isLastLineageChild: isLast } as WorktreeRow
}

const view: WorktreeGroupsView = {
  groups: { checkout: { id: 'checkout', name: 'Feature checkout', color: 'violet' } },
  membership: { app: 'checkout', backend: 'checkout' },
  collapsed: {}
}

function run(worktrees: Worktree[], groupsView: WorktreeGroupsView | undefined) {
  const result: Row[] = []
  const ungrouped = appendWorktreeGroupRows({
    result,
    worktrees,
    sectionKey: 'status:in-progress',
    groupDepth: 0,
    view: groupsView,
    buildMemberRow: memberRow
  })
  return { result, ungrouped }
}

describe('appendWorktreeGroupRows', () => {
  it('leaves every worktree to the caller when there are no groups', () => {
    const items = [worktree('app'), worktree('other')]
    const { result, ungrouped } = run(items, undefined)
    expect(result).toEqual([])
    expect(ungrouped).toEqual(items)
  })

  it('emits the group header and its members from different repos, and returns the rest', () => {
    const items = [worktree('app'), worktree('other'), worktree('backend', 'repo-b')]
    const { result, ungrouped } = run(items, view)

    expect(result.map((row) => row.type)).toEqual(['cachalote-worktree-group', 'item', 'item'])
    expect(result[0]).toMatchObject({
      key: 'status:in-progress:cachalote-group:checkout',
      name: 'Feature checkout',
      color: 'violet',
      count: 2,
      worktreeIds: ['app', 'backend']
    })
    expect(result.slice(1)).toMatchObject([
      { worktree: { id: 'app' }, isLastLineageChild: false },
      { worktree: { id: 'backend' }, isLastLineageChild: true }
    ])
    expect(ungrouped.map((item) => item.id)).toEqual(['other'])
  })

  it('counts only the members that fall in the section', () => {
    const { result } = run([worktree('backend', 'repo-b')], view)
    expect(result[0]).toMatchObject({ count: 1, worktreeIds: ['backend'] })
  })

  it('hides the members of a collapsed group', () => {
    const { result } = run([worktree('app'), worktree('backend')], {
      ...view,
      collapsed: { checkout: true }
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ type: 'cachalote-worktree-group', collapsed: true, count: 2 })
  })

  it('treats membership in an unknown group as ungrouped', () => {
    const { result, ungrouped } = run([worktree('app')], {
      ...view,
      groups: {}
    })
    expect(result).toEqual([])
    expect(ungrouped.map((item) => item.id)).toEqual(['app'])
  })
})
