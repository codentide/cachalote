import { Circle, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { LiveSlotState } from '../../../../shared/cachalote/live/live-types'
import { liveLabel } from './live-labels'
import { LIVE_TONE_TEXT, livePhaseLabel, liveTone } from './live-slot-presentation'
import { liveActions, useWorktreeLiveSlots } from './live-store'
import { useOpenLivePort } from './use-open-live-port'

function LiveSlotPill({
  slot,
  pushRight
}: {
  slot: LiveSlotState
  pushRight: boolean
}): React.JSX.Element {
  const tone = liveTone(slot.phase)
  const openPort = useOpenLivePort(slot.worktreeId)
  const ref = { repoId: slot.repoId, slotId: slot.slotId }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-live-phase={slot.phase}
          aria-label={liveLabel('pillAria', { port: slot.port })}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded px-1 font-mono text-2xs tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring',
            LIVE_TONE_TEXT[tone],
            pushRight && 'ml-auto'
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {tone === 'pending' ? (
            <LoaderCircle className="size-2.5 animate-spin" />
          ) : (
            <Circle className="size-2 fill-current" />
          )}
          {`:${slot.port}`}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-64"
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.stopPropagation()}
      >
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs font-medium">{slot.label}</span>
            <span className="font-mono text-2xs tabular-nums text-muted-foreground">
              {liveLabel('popoverPort')} :{slot.port}
            </span>
          </div>
          <p className={cn('text-2xs', LIVE_TONE_TEXT[tone])}>
            {liveLabel('popoverPhase')}: {livePhaseLabel(slot.phase)}
          </p>
          {slot.error ? (
            <p className="break-words text-2xs text-destructive">
              {liveLabel('popoverError')}: {slot.error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={(event) => openPort(slot.port, event)}
            >
              {liveLabel('openInBrowser')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void liveActions.focusTerminal(ref)}
            >
              {liveLabel('viewLogs')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void liveActions.stop(ref)}
            >
              {liveLabel('stop')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** The "● :3000" pill on the row of a worktree a slot serves; nothing otherwise. */
export function LivePill({
  worktreeId,
  pushRight
}: {
  worktreeId: string
  /** True when the row has no details block to sit after, so the pill pushes itself right. */
  pushRight: boolean
}): React.JSX.Element | null {
  const slots = useWorktreeLiveSlots(worktreeId)
  if (slots.length === 0) {
    return null
  }
  return (
    <>
      {slots.map((slot, index) => (
        <LiveSlotPill
          key={`${slot.repoId}:${slot.slotId}`}
          slot={slot}
          // Only the first pill pushes right; the next ones follow it.
          pushRight={pushRight && index === 0}
        />
      ))}
    </>
  )
}
