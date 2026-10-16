import { useState } from 'react'
import { Radio } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../../components/status-bar/status-bar-context-menu-policy'
import { liveLabel } from './live-labels'
import { useLiveStore, useLiveStoreStarted } from './live-store'
import { LiveStatusRow } from './LiveStatusRow'

/** Rows live in their own component so the app-store reads only happen while the popover is open. */
function LiveStatusRows(): React.JSX.Element {
  const slots = useLiveStore((s) => s.slots)
  const repos = useAppStore((s) => s.repos)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  return (
    <div className="max-h-[28rem] divide-y divide-border/40 overflow-y-auto scrollbar-sleek">
      {slots.map((slot) => (
        <LiveStatusRow
          key={`${slot.repoId}:${slot.slotId}`}
          slot={slot}
          projectName={repos.find((repo) => repo.id === slot.repoId)?.displayName ?? slot.repoId}
          worktrees={worktreesByRepo[slot.repoId] ?? []}
        />
      ))}
    </div>
  )
}

/** Status bar segment "Sonar N" with a popover listing every slot. */
export function LiveStatusSegment({
  iconOnly
}: {
  compact?: boolean
  iconOnly: boolean
}): React.JSX.Element | null {
  useLiveStoreStarted()
  const supported = useLiveStore((s) => s.supported)
  const slots = useLiveStore((s) => s.slots)
  const [open, setOpen] = useState(false)
  if (!supported || slots.length === 0) {
    return null
  }
  const serving = slots.filter((slot) => slot.worktreeId !== null).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent/70"
              aria-label={liveLabel('segmentAria', { count: serving })}
            >
              <Radio className="size-3 text-muted-foreground" />
              <span className="text-2xs font-medium tabular-nums text-muted-foreground">
                {iconOnly ? serving : liveLabel('segmentLabel', { count: serving })}
              </span>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {liveLabel('segmentAria', { count: serving })}
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
        className="w-[24rem] max-w-[calc(100vw-2rem)]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-2xs font-medium text-foreground">
            <Radio className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{liveLabel('popoverTitle')}</span>
          </div>
          <span className="text-2xs tabular-nums text-muted-foreground">
            {liveLabel('popoverSummary', { count: serving })}
          </span>
        </div>
        <LiveStatusRows />
        <p className="border-t border-border/60 px-3 py-2 text-2xs text-muted-foreground">
          {liveLabel('externalNote')}
        </p>
      </PopoverContent>
    </Popover>
  )
}
