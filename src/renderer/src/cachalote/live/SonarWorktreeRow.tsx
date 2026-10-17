import { Check, Circle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { LiveSlotState } from '../../../../shared/cachalote/live/live-types'
import { liveLabel } from './live-labels'
import { LIVE_TONE_TEXT, liveTone } from './live-slot-presentation'
import { liveActions } from './live-store'
import type { SonarPanelWorktree } from './sonar-panel-model'

const ROW_CLASS =
  'flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[current=true]:bg-accent'

/** One worktree of a project; clicking it serves it on the project's slot (or lets you pick one). */
export function SonarWorktreeRow({
  repoId,
  worktree,
  slots
}: {
  repoId: string
  worktree: SonarPanelWorktree
  slots: readonly LiveSlotState[]
}): React.JSX.Element {
  const serving = slots.filter((slot) => worktree.servingSlotIds.includes(slot.slotId))
  const current = serving.length > 0
  const single = slots.length === 1 ? slots[0] : null
  const serve = (slotId: string): void =>
    void liveActions.project({ repoId, slotId, worktreeId: worktree.id })

  const content = (
    <>
      <span className="min-w-0 flex-1 truncate">{worktree.name}</span>
      {serving.map((slot) => (
        <span
          key={slot.slotId}
          className="flex shrink-0 items-center gap-1 font-mono text-2xs tabular-nums text-muted-foreground"
        >
          <Circle className={cn('size-1.5 fill-current', LIVE_TONE_TEXT[liveTone(slot.phase)])} />
          {`:${slot.port}`}
        </span>
      ))}
    </>
  )
  const rowProps = {
    type: 'button',
    className: ROW_CLASS,
    'data-current': current ? 'true' : undefined,
    'aria-current': current ? ('true' as const) : undefined
  } as const

  const main = single ? (
    // The visible name stays the accessible name; the action is only a hint on rows not yet live.
    <button
      {...rowProps}
      title={current ? undefined : liveLabel('serveOn', { port: single.port })}
      onClick={() => {
        if (!worktree.servingSlotIds.includes(single.slotId)) {
          serve(single.slotId)
        }
      }}
    >
      {content}
    </button>
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button {...rowProps} title={liveLabel('serveOnMenu')}>
          {content}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {slots.map((slot) => {
          const isServing = worktree.servingSlotIds.includes(slot.slotId)
          return (
            <DropdownMenuItem
              key={slot.slotId}
              disabled={isServing}
              onSelect={() => serve(slot.slotId)}
            >
              <span className="flex-1">
                {liveLabel('serveOnSlot', { port: slot.port, label: slot.label })}
              </span>
              {isServing ? <Check className="size-3.5" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="group flex items-center gap-0.5">
      {main}
      {worktree.standby ? (
        <span className="shrink-0 can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:focus-within:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={liveLabel('dismissStandby')}
                onClick={() => void liveActions.dismissStandby({ repoId, worktreeId: worktree.id })}
              >
                <X className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {liveLabel('dismissStandby')}
            </TooltipContent>
          </Tooltip>
        </span>
      ) : null}
    </div>
  )
}
