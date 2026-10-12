import type { Repo } from '../../repo-types'
import type { Row } from '../../sidebar-list/row-types'
import type { WorktreeOccurrence } from '../../worktree-occurrence-plan'
import { getWorktreeHostIdentity } from '../../worktree/host-qualified-identity'
import type { Worktree } from '../../worktree/types'

/** What the sidebar row plan reads about worktree groups; the renderer store's view satisfies it. */
export type WorktreeGroupsRowView = {
  groups: Readonly<Record<string, { name: string }>>
  /** worktree id → group id */
  membership: Readonly<Record<string, string>>
  /** group ids collapsed in every section they appear in */
  collapsed: Readonly<Record<string, true>>
}

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

type GroupRowOptions = {
  groupDepth: number
  sectionKey: string
  hostContextLabelByRepoId?: ReadonlyMap<string, string>
  hostContextLabelByWorktreeIdentity?: ReadonlyMap<string, string>
  worktreeGroups?: WorktreeGroupsRowView
}

// Own membership first; otherwise a grouped ancestor takes its lineage children along, so none
// renders indented under a parent that moved into a group.
function groupIdOf(
  occurrence: WorktreeOccurrence<Worktree>,
  view: WorktreeGroupsRowView
): string | undefined {
  for (
    let current: WorktreeOccurrence<Worktree> | undefined = occurrence;
    current;
    current = current.parent
  ) {
    const groupId = view.membership[current.row.id]
    if (groupId && view.groups[groupId]) {
      return groupId
    }
  }
  return undefined
}

/**
 * Takes the section's grouped worktrees out of `occurrences` (in place) and emits each group first:
 * a header, then its members one step in, flat. Groups keep the order of their first member and
 * members keep the section's order. Pinned occurrences are never grouped.
 */
export function spliceWorktreeGroupRows(
  result: Row[],
  occurrences: WorktreeOccurrence<Worktree>[],
  repoMap: Map<string, Repo>,
  options: GroupRowOptions
): void {
  const view = options.worktreeGroups
  if (!view || Object.keys(view.membership).length === 0) {
    return
  }
  const kept: WorktreeOccurrence<Worktree>[] = []
  const membersByGroupId = new Map<string, WorktreeOccurrence<Worktree>[]>()
  for (const occurrence of occurrences) {
    const groupId = occurrence.placement === 'pinned' ? undefined : groupIdOf(occurrence, view)
    if (!groupId) {
      kept.push(occurrence)
      continue
    }
    const members = membersByGroupId.get(groupId) ?? []
    members.push(occurrence)
    membersByGroupId.set(groupId, members)
  }
  if (membersByGroupId.size === 0) {
    return
  }
  occurrences.splice(0, occurrences.length, ...kept)

  for (const [groupId, members] of membersByGroupId) {
    const collapsed = view.collapsed[groupId] === true
    result.push({
      type: 'cachalote-worktree-group',
      key: `${options.sectionKey}:cachalote-group:${groupId}`,
      sectionKey: options.sectionKey,
      groupId,
      name: view.groups[groupId]?.name ?? '',
      count: members.length,
      collapsed,
      groupDepth: options.groupDepth,
      worktreeIds: members.map((member) => member.row.id)
    })
    if (collapsed) {
      continue
    }
    for (const [index, member] of members.entries()) {
      const worktree = member.row
      result.push({
        type: 'item',
        occurrence: member,
        rowKey: member.key,
        sectionKey: member.sectionKey,
        worktree,
        repo: repoMap.get(worktree.repoId),
        depth: 1,
        groupDepth: options.groupDepth,
        isLastLineageChild: index === members.length - 1,
        lineageChildCount: 0,
        showProjectName: member.showProjectName,
        hostContextLabel:
          options.hostContextLabelByWorktreeIdentity?.get(getWorktreeHostIdentity(worktree)) ??
          options.hostContextLabelByRepoId?.get(worktree.repoId)
      })
    }
  }
}
