import type { RepoOfWorktree, Row } from '../../sidebar-list/row-types'
import type { WorktreeOccurrence } from '../../worktree-occurrence-plan'
import { getWorktreeHostIdentity } from '../../worktree/host-qualified-identity'
import type { Worktree } from '../../worktree/types'

/** What the sidebar row plan reads about worktree groups; the renderer store's view satisfies it. */
export type WorktreeGroupsRowView = {
  groups: Readonly<Record<string, { name: string; color?: string; icon?: string }>>
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
  /** Workspace-status palette key; undefined keeps the muted icon. */
  color: string | undefined
  /** Icon id from the fork's curated set; undefined shows the default. */
  icon: string | undefined
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
  repoOf: RepoOfWorktree,
  options: GroupRowOptions
): void {
  const view = options.worktreeGroups
  if (!view || Object.keys(view.membership).length === 0) {
    return
  }
  const groupOf = new Map<WorktreeOccurrence<Worktree>, string>()
  const directMembers = new Map<string, number>()
  for (const occurrence of occurrences) {
    const groupId = occurrence.placement === 'pinned' ? undefined : groupIdOf(occurrence, view)
    if (groupId) {
      groupOf.set(occurrence, groupId)
      if (view.membership[occurrence.row.id] === groupId) {
        directMembers.set(groupId, (directMembers.get(groupId) ?? 0) + 1)
      }
    }
  }
  const kept: WorktreeOccurrence<Worktree>[] = []
  const membersByGroupId = new Map<string, WorktreeOccurrence<Worktree>[]>()
  for (const occurrence of occurrences) {
    const groupId = groupOf.get(occurrence)
    // A folder only where two or more of the group's worktrees share the section; a lone one stays
    // in place and shows the group's icon instead.
    if (!groupId || (directMembers.get(groupId) ?? 0) < 2) {
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
      color: view.groups[groupId]?.color,
      icon: view.groups[groupId]?.icon,
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
        repo: repoOf(worktree),
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
