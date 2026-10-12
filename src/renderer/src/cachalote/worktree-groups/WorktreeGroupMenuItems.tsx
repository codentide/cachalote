import { Layers, Plus, Ungroup } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import type { Worktree } from '../../../../shared/worktree/types'
import { useWorktreeGroupsStore } from './worktree-groups-store'
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

  return (
    <>
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
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {anyGrouped && (
        <DropdownMenuItem disabled={disabled} onSelect={() => removeFromGroup(targetIds)}>
          <Ungroup className="size-3.5" />
          {worktreeGroupLabel('remove')}
        </DropdownMenuItem>
      )}
      {/* Keeps the parent-worktree actions below visually apart from these. */}
      <DropdownMenuSeparator />
    </>
  )
}
