import { describe, expect, it } from 'vitest'
import type { Row } from '../../sidebar-list/row-types'
import type { WorktreeOccurrence } from '../../worktree-occurrence-plan'
import type { Worktree } from '../../worktree/types'
import { spliceWorktreeGroupRows, type WorktreeGroupsRowView } from './worktree-group-rows'

const SECTION = 'status:in-progress'

function worktree(id: string, repoId = 'repo-a'): Worktree {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the splice reads only id and repoId.
  return { id, repoId } as Worktree
}

function occurrence(
  id: string,
  options: {
    repoId?: string
    parent?: WorktreeOccurrence<Worktree>
    placement?: 'pinned' | 'natural'
  } = {}
): WorktreeOccurrence<Worktree> {
  return {
    key: `${SECTION}:${id}`,
    row: worktree(id, options.repoId),
    sectionKey: SECTION,
    placement: options.placement ?? 'natural',
    sectionPath: { key: SECTION },
    parent: options.parent,
    depth: options.parent ? options.parent.depth + 1 : 0,
    childCount: 0,
    isLastChild: true,
    showProjectName: false
  }
}

const view: WorktreeGroupsRowView = {
  groups: { checkout: { name: 'Feature checkout', color: 'violet' } },
  membership: { app: 'checkout', backend: 'checkout' },
  collapsed: {}
}

function run(occurrences: WorktreeOccurrence<Worktree>[], groupsView?: WorktreeGroupsRowView) {
  const result: Row[] = []
  spliceWorktreeGroupRows(result, occurrences, () => undefined, {
    groupDepth: 0,
    sectionKey: SECTION,
    worktreeGroups: groupsView
  })
  return { result, kept: occurrences.map((item) => item.row.id) }
}

describe('spliceWorktreeGroupRows', () => {
  it('leaves every occurrence to the caller when there are no groups', () => {
    const { result, kept } = run([occurrence('app'), occurrence('other')])
    expect(result).toEqual([])
    expect(kept).toEqual(['app', 'other'])
  })

  it('emits the group header and its members from different repos, and keeps the rest', () => {
    const { result, kept } = run(
      [occurrence('app'), occurrence('other'), occurrence('backend', { repoId: 'repo-b' })],
      view
    )
    expect(result.map((row) => row.type)).toEqual(['cachalote-worktree-group', 'item', 'item'])
    expect(result[0]).toMatchObject({
      key: `${SECTION}:cachalote-group:checkout`,
      name: 'Feature checkout',
      color: 'violet',
      count: 2,
      worktreeIds: ['app', 'backend']
    })
    expect(result.slice(1)).toMatchObject([
      { worktree: { id: 'app' }, depth: 1, isLastLineageChild: false, lineageChildCount: 0 },
      { worktree: { id: 'backend' }, depth: 1, isLastLineageChild: true }
    ])
    expect(kept).toEqual(['other'])
  })

  it('leaves a lone member of the section in place, without a folder', () => {
    const { result, kept } = run(
      [occurrence('other'), occurrence('backend', { repoId: 'repo-b' })],
      view
    )
    expect(result).toEqual([])
    expect(kept).toEqual(['other', 'backend'])
  })

  it('carries the group icon on the folder', () => {
    const { result } = run([occurrence('app'), occurrence('backend')], {
      ...view,
      groups: { checkout: { name: 'Feature checkout', icon: 'bug' } }
    })
    expect(result[0]).toMatchObject({ icon: 'bug' })
  })

  it('does not count a lineage child toward the two members a folder needs', () => {
    const parent = occurrence('app')
    const { result, kept } = run([parent, occurrence('app-child', { parent })], view)
    expect(result).toEqual([])
    expect(kept).toEqual(['app', 'app-child'])
  })

  it('hides the members of a collapsed group', () => {
    const { result } = run([occurrence('app'), occurrence('backend')], {
      ...view,
      collapsed: { checkout: true }
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ type: 'cachalote-worktree-group', collapsed: true, count: 2 })
  })

  it('treats membership in an unknown group as ungrouped', () => {
    const { result, kept } = run([occurrence('app')], {
      ...view,
      groups: {},
      membership: { app: 'gone' }
    })
    expect(result).toEqual([])
    expect(kept).toEqual(['app'])
  })

  it('takes lineage children along with a grouped parent, flat', () => {
    const parent = occurrence('app')
    const child = occurrence('app-child', { parent })
    const { result, kept } = run([parent, child, occurrence('other'), occurrence('backend')], view)
    expect(result.slice(1)).toMatchObject([
      { worktree: { id: 'app' }, depth: 1 },
      { worktree: { id: 'app-child' }, depth: 1 },
      { worktree: { id: 'backend' }, depth: 1 }
    ])
    expect(kept).toEqual(['other'])
  })

  it('never groups a pinned occurrence', () => {
    const { result, kept } = run(
      [occurrence('app', { placement: 'pinned' }), occurrence('backend')],
      view
    )
    expect(result).toEqual([])
    expect(kept).toEqual(['app', 'backend'])
  })
})
