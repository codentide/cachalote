import type { Worktree } from '../../../../shared/worktree/types'
import type { Row, WorktreeRow } from '../../components/sidebar/worktree-list/grouping/row-types'
import type { WorktreeGroupsView } from './worktree-groups-store'

/** A feature group inside one sidebar section: only the members that fall in that section. */
export type CachaloteWorktreeGroupRow = {
  type: 'cachalote-worktree-group'
  key: string
  sectionKey: string
  groupId: string
  name: string
  count: number
  collapsed: boolean
  groupDepth: number
  worktreeIds: readonly string[]
}

export const CACHALOTE_WORKTREE_GROUP_ROW_HEIGHT = 30

/**
 * Emits each group present in the section (header row, then its members one step in) and returns the
 * worktrees that belong to no group, for the caller to render as usual. Groups keep the order of
 * their first member, and members keep the section's order, so the section's sort still applies.
 */
export function appendWorktreeGroupRows(args: {
  result: Row[]
  worktrees: readonly Worktree[]
  sectionKey: string
  groupDepth: number
  view: WorktreeGroupsView | undefined
  buildMemberRow: (worktree: Worktree, isLast: boolean) => WorktreeRow
}): Worktree[] {
  const { result, worktrees, sectionKey, groupDepth, view, buildMemberRow } = args
  if (!view || Object.keys(view.membership).length === 0) {
    return [...worktrees]
  }
  const ungrouped: Worktree[] = []
  const membersByGroupId = new Map<string, Worktree[]>()
  for (const worktree of worktrees) {
    const groupId = view.membership[worktree.id]
    if (!groupId || !view.groups[groupId]) {
      ungrouped.push(worktree)
      continue
    }
    const members = membersByGroupId.get(groupId) ?? []
    members.push(worktree)
    membersByGroupId.set(groupId, members)
  }
  for (const [groupId, members] of membersByGroupId) {
    const collapsed = view.collapsed[groupId] === true
    result.push({
      type: 'cachalote-worktree-group',
      key: `${sectionKey}:cachalote-group:${groupId}`,
      sectionKey,
      groupId,
      name: view.groups[groupId]!.name,
      count: members.length,
      collapsed,
      groupDepth,
      worktreeIds: members.map((worktree) => worktree.id)
    })
    if (collapsed) {
      continue
    }
    for (const [index, member] of members.entries()) {
      result.push(buildMemberRow(member, index === members.length - 1))
    }
  }
  return ungrouped
}
