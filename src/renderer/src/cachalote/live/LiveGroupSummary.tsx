import { useMemo } from 'react'
import { Circle, Radio } from 'lucide-react'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useWorktreeGroupsStore } from '../worktree-groups/worktree-groups-store'
import { planLiveGroupProjection, summarizeLiveGroup } from './live-group-model'
import { liveLabel } from './live-labels'
import { liveActions, useLiveStore, useLiveStoreStarted } from './live-store'

function useGroupMemberIds(groupId: string): string[] {
  const membership = useWorktreeGroupsStore((s) => s.membership)
  return useMemo(
    () =>
      Object.entries(membership)
        .filter(([, memberGroupId]) => memberGroupId === groupId)
        .map(([worktreeId]) => worktreeId),
    [membership, groupId]
  )
}

/** "● n/m" on a worktree-group header: members served live out of members with a slot. */
export function LiveGroupSummary({ groupId }: { groupId: string }): React.JSX.Element | null {
  useLiveStoreStarted()
  const memberIds = useGroupMemberIds(groupId)
  const slots = useLiveStore((s) => s.slots)
  const { eligible, live } = summarizeLiveGroup(memberIds, slots)
  // Only while something is live: seeded projects would put a gray 0/n on most groups.
  if (eligible === 0 || live === 0) {
    return null
  }
  const text = liveLabel('groupSummaryAria', { live, total: eligible })
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={text}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 text-2xs tabular-nums',
            live === eligible ? 'text-status-success' : 'text-muted-foreground'
          )}
        >
          <Circle className="size-2 fill-current" />
          {`${live}/${eligible}`}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

/** "Serve group live": every member to its slot, or disabled with a hint when a choice is needed. */
export function LiveGroupMenuItem({ groupId }: { groupId: string }): React.JSX.Element | null {
  useLiveStoreStarted()
  const memberIds = useGroupMemberIds(groupId)
  const slots = useLiveStore((s) => s.slots)
  const plan = planLiveGroupProjection(memberIds, slots)
  if (plan.kind === 'none') {
    return null
  }
  return (
    <>
      <ContextMenuItem
        disabled={plan.kind !== 'ready'}
        onSelect={() => {
          if (plan.kind === 'ready') {
            for (const assignment of plan.assignments) {
              void liveActions.project(assignment)
            }
          }
        }}
      >
        <Radio className="size-3.5" />
        {liveLabel('groupServe')}
      </ContextMenuItem>
      {plan.kind === 'ambiguous' ? (
        <p className="px-2 pb-1 text-2xs text-muted-foreground">
          {liveLabel('groupServeAmbiguous')}
        </p>
      ) : null}
    </>
  )
}
