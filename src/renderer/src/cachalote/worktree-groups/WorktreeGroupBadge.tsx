import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getWorkspaceStatusColorOptions } from '../../components/sidebar/workspace-status'
import { useWorktreeGroupFolderMembers } from './worktree-group-folder-members'
import { WorktreeGroupIcon } from './worktree-group-icons'
import { useWorktreeGroupsStore } from './worktree-groups-store'

/** The group's icon on a member the sidebar shows outside its group's folder. */
export function WorktreeGroupBadge({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const group = useWorktreeGroupsStore((s) => {
    const groupId = s.membership[worktreeId]
    return groupId ? s.groups[groupId] : undefined
  })
  const inFolder = useWorktreeGroupFolderMembers((s) => s.inFolder.has(worktreeId))
  if (!group || inFolder) {
    return null
  }
  const tone = getWorkspaceStatusColorOptions().find((option) => option.id === group.color)?.tone
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0 items-center" aria-label={group.name}>
          <WorktreeGroupIcon
            icon={group.icon}
            className={cn('size-3 text-muted-foreground', tone)}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{group.name}</TooltipContent>
    </Tooltip>
  )
}
