import { useEffect, useState } from 'react'
import { Check, ChevronDown, Circle, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { LiveSlotState } from '../../../../shared/cachalote/live/live-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { liveLabel } from './live-labels'
import {
  formatBytes,
  formatUptime,
  LIVE_TONE_TEXT,
  livePhaseLabel,
  liveTone
} from './live-slot-presentation'
import { liveActions } from './live-store'

type SlotRowProps = {
  slot: LiveSlotState
  /** Omitted when the surrounding UI already names the project. */
  projectName?: string
  /** Worktrees of the slot's repo, for the served name and the "change" dropdown. */
  worktrees: readonly Worktree[]
  showChange?: boolean
  /** Clock for the uptime; defaults to the mount time. */
  now?: number
  /** Changing it re-reads the RAM. */
  usageRefreshKey?: number
  /** Rendered first in the actions row, before Stop. */
  extraActions?: React.ReactNode
}

/** One slot in the status bar popover; its RAM is read once, when the popover opens. */
export function LiveStatusRow({
  slot,
  projectName,
  worktrees,
  showChange = true,
  now,
  usageRefreshKey,
  extraActions
}: SlotRowProps): React.JSX.Element {
  const [rssBytes, setRssBytes] = useState<number | null>(null)
  const [confirmFree, setConfirmFree] = useState(false)
  // Uptime is read once when the popover opens, like the RAM; no ticking.
  const [openedAt] = useState(() => Date.now())
  const { repoId, slotId, phase } = slot
  const tone = liveTone(phase)
  const owner = slot.portOwner
  const served = worktrees.find((worktree) => worktree.id === slot.worktreeId)
  const worktreeName = served?.displayName ?? slot.worktreeId

  useEffect(() => {
    if (phase !== 'live') {
      return
    }
    let cancelled = false
    void liveActions.usage({ repoId, slotId }).then((bytes) => {
      if (!cancelled) {
        setRssBytes(bytes)
      }
    })
    return () => {
      cancelled = true
    }
  }, [repoId, slotId, phase, usageRefreshKey])

  const details = [
    slot.startedAt !== null && phase === 'live'
      ? liveLabel('uptime', { time: formatUptime(slot.startedAt, now ?? openedAt) })
      : null,
    phase === 'live' && rssBytes !== null
      ? liveLabel('memory', { size: formatBytes(rssBytes) })
      : null
  ].filter((part) => part !== null)

  return (
    <div className="space-y-1 px-3 py-2" data-live-slot={`${repoId}:${slotId}`}>
      <div className="flex items-center gap-2">
        {tone === 'pending' ? (
          <LoaderCircle className="size-3 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Circle className={cn('size-2 shrink-0 fill-current', LIVE_TONE_TEXT[tone])} />
        )}
        <span className="font-mono text-xs font-medium tabular-nums">{`:${slot.port}`}</span>
        {projectName !== undefined ? (
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {projectName}
          </span>
        ) : null}
        <span
          className={cn(
            'shrink-0 text-2xs',
            projectName === undefined && 'ml-auto',
            LIVE_TONE_TEXT[tone]
          )}
        >
          {livePhaseLabel(phase)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs">
          {worktreeName ?? liveLabel('noWorktree')}
        </span>
        {details.length > 0 ? (
          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
            {details.join(' · ')}
          </span>
        ) : null}
      </div>
      {slot.error ? <p className="break-words text-2xs text-destructive">{slot.error}</p> : null}
      {phase === 'port-busy' && owner ? (
        <div className="space-y-1 text-2xs text-muted-foreground">
          <p className="break-all font-mono">
            {liveLabel('portOwner')} pid {owner.pid} · {owner.command}
            {owner.cwd ? ` · ${owner.cwd}` : ''}
          </p>
          <Button type="button" variant="outline" size="xs" onClick={() => setConfirmFree(true)}>
            {liveLabel('freePort')}
          </Button>
        </div>
      ) : null}
      <div className="flex items-center gap-1.5">
        {extraActions}
        {showChange ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-label={liveLabel('changeAria', { port: slot.port })}
              >
                {liveLabel('change')}
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <div className="max-h-64 overflow-y-auto scrollbar-sleek">
                {worktrees.length === 0 ? (
                  <DropdownMenuItem disabled>{liveLabel('noWorktrees')}</DropdownMenuItem>
                ) : (
                  worktrees.map((worktree) => (
                    <DropdownMenuItem
                      key={worktree.id}
                      disabled={worktree.id === slot.worktreeId}
                      onSelect={() =>
                        void liveActions.project({ repoId, slotId, worktreeId: worktree.id })
                      }
                    >
                      <span className="flex-1">{worktree.displayName}</span>
                      {worktree.id === slot.worktreeId ? <Check className="size-3.5" /> : null}
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={slot.worktreeId === null}
          onClick={() => void liveActions.stop({ repoId, slotId })}
        >
          {liveLabel('stop')}
        </Button>
      </div>
      {owner ? (
        <Dialog open={confirmFree} onOpenChange={setConfirmFree}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{liveLabel('freePortTitle', { port: slot.port })}</DialogTitle>
              <DialogDescription>
                {liveLabel('freePortDescription', {
                  pid: owner.pid,
                  command: owner.command
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmFree(false)}>
                {liveLabel('cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setConfirmFree(false)
                  void liveActions.freePort({ port: slot.port, pid: owner.pid })
                }}
              >
                {liveLabel('freePort')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
