import { useMemo } from 'react'
import { Layers, Plus, Trash2, Ungroup } from 'lucide-react'
import { useAppStore } from '@/store'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import type { Worktree } from '../../../../shared/worktree/types'
import { useWorktreeGroupsStore } from './worktree-groups-store'
import { orphanWorktreeGroups } from './worktree-group-orphans'
import { AFTER_MENU_CLOSE_MS, worktreeGroupLabel } from './worktree-group-labels'

/** "Add to Group" / "Remove from Group" for every workspace the context menu targets. */
export function WorktreeGroupMenuItems({
  targets,
  disabled
}: {
  targets: readonly Worktree[]
  disabled: boolean
}): React.JSX.Element {
  const groups = useWorktreeGroupsStore((s) => s.groups)
  const membership = useWorktreeGroupsStore((s) => s.membership)
  const requestName = useWorktreeGroupsStore((s) => s.requestName)
  const addToGroup = useWorktreeGroupsStore((s) => s.addToGroup)
  const removeFromGroup = useWorktreeGroupsStore((s) => s.removeFromGroup)
  const targetIds = targets.map((worktree) => worktree.id)
  const sharedGroupId =
    targetIds.length > 0 && targetIds.every((id) => membership[id] === membership[targetIds[0]!])
      ? (membership[targetIds[0]!] ?? null)
      : null
  const anyGrouped = targetIds.some((id) => membership[id] !== undefined)
  const sortedGroups = Object.values(groups).sort((left, right) =>
    left.name.localeCompare(right.name)
  )
  const deleteGroup = useWorktreeGroupsStore((s) => s.deleteGroup)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const orphans = useMemo(
    () =>
      orphanWorktreeGroups(
        { groups, membership },
        new Set(Object.values(worktreesByRepo).flatMap((list) => list.map((w) => w.id)))
      ),
    [groups, membership, worktreesByRepo]
  )

  return (
    <>
      {/* Apart from the workspace status above; the next block brings its own separator. */}
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={disabled}>
          <Layers className="size-3.5" />
          {worktreeGroupLabel('menu')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem
            onSelect={() =>
              window.setTimeout(
                () => requestName({ mode: 'create', worktreeIds: targetIds }),
                AFTER_MENU_CLOSE_MS
              )
            }
          >
            <Plus className="size-3.5" />
            {worktreeGroupLabel('newGroup')}
          </DropdownMenuItem>
          {sortedGroups.length > 0 && <DropdownMenuSeparator />}
          {sortedGroups.map((group) => (
            <DropdownMenuItem
              key={group.id}
              disabled={sharedGroupId === group.id}
              onSelect={() => addToGroup(group.id, targetIds)}
            >
              {group.name}
            </DropdownMenuItem>
          ))}
          {orphans.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Trash2 className="size-3.5" />
                  {worktreeGroupLabel('deleteOrphan')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {orphans.map(({ group, staleMembers }) => (
                    <DropdownMenuItem key={group.id} onSelect={() => deleteGroup(group.id)}>
                      <span className="flex-1">{group.name}</span>
                      {/* Ids of worktrees it still points at: deleted, or on a host not loaded now. */}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {staleMembers}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {anyGrouped && (
        <DropdownMenuItem disabled={disabled} onSelect={() => removeFromGroup(targetIds)}>
          <Ungroup className="size-3.5" />
          {worktreeGroupLabel('remove')}
        </DropdownMenuItem>
      )}
    </>
  )
}
