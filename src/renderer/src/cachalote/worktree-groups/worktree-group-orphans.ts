import type { WorktreeGroup, WorktreeGroupsView } from './worktree-groups-store'

export type OrphanWorktreeGroup = { group: WorktreeGroup; staleMembers: number }

/**
 * Groups none of whose members is a worktree the app knows now: every member was deleted, or sits on
 * a host that is not loaded. Never pruned on its own, since an offline host looks the same.
 */
export function orphanWorktreeGroups(
  view: Pick<WorktreeGroupsView, 'groups' | 'membership'>,
  liveWorktreeIds: ReadonlySet<string>
): OrphanWorktreeGroup[] {
  const members = new Map<string, { live: number; stale: number }>()
  for (const [worktreeId, groupId] of Object.entries(view.membership)) {
    const count = members.get(groupId) ?? { live: 0, stale: 0 }
    if (liveWorktreeIds.has(worktreeId)) {
      count.live += 1
    } else {
      count.stale += 1
    }
    members.set(groupId, count)
  }
  return Object.values(view.groups)
    .filter((group) => (members.get(group.id)?.live ?? 0) === 0)
    .map((group) => ({ group, staleMembers: members.get(group.id)?.stale ?? 0 }))
    .sort((left, right) => left.group.name.localeCompare(right.group.name))
}
