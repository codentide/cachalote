import { useId, useState } from 'react'
import { ChevronRight, ExternalLink, Plus, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import type { LiveSlotState } from '../../../../shared/cachalote/live/live-types'
import { liveLabel } from './live-labels'
import { LiveStatusRow } from './LiveStatusRow'
import { liveActions } from './live-store'
import type { SonarPanelSection } from './sonar-panel-model'
import { SonarSlotLogs } from './SonarSlotLogs'
import { SonarWorktreeRow } from './SonarWorktreeRow'
import { useOpenLivePort } from './use-open-live-port'

function SonarSlotBlock({
  slot,
  now,
  isVisible
}: {
  slot: LiveSlotState
  now: number
  isVisible: boolean
}): React.JSX.Element {
  const worktrees = useAppStore((s) => s.worktreesByRepo[slot.repoId])
  const openPort = useOpenLivePort(slot.worktreeId)
  const [logsOpen, setLogsOpen] = useState(false)
  const logsLabel = liveLabel(logsOpen ? 'hideLogs' : 'showLogs')

  return (
    <div>
      <LiveStatusRow
        slot={slot}
        worktrees={worktrees ?? []}
        showChange={false}
        now={now}
        usageRefreshKey={now}
        extraActions={
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={liveLabel('openInBrowser')}
                  disabled={slot.phase !== 'live'}
                  onClick={(event) => openPort(slot.port, event)}
                >
                  <ExternalLink />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                {liveLabel('openInBrowser')}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={logsLabel}
                  aria-pressed={logsOpen}
                  onClick={() => setLogsOpen((open) => !open)}
                >
                  <ScrollText />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                {logsLabel}
              </TooltipContent>
            </Tooltip>
          </>
        }
      />
      {logsOpen ? (
        <SonarSlotLogs repoId={slot.repoId} slotId={slot.slotId} active={isVisible} />
      ) : null}
    </div>
  )
}

function ServeAnotherMenu({ section }: { section: SonarPanelSection }): React.JSX.Element {
  const { repoId, slots } = section
  const serve = (slotId: string, worktreeId: string): void =>
    void liveActions.project({ repoId, slotId, worktreeId })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="xs" className="mt-1 ml-1.5">
          <Plus />
          {liveLabel('serveAnother')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <div className="max-h-64 overflow-y-auto scrollbar-sleek">
          {section.others.map((other) =>
            slots.length === 1 ? (
              <DropdownMenuItem key={other.id} onSelect={() => serve(slots[0].slotId, other.id)}>
                {other.name}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuSub key={other.id}>
                <DropdownMenuSubTrigger>{other.name}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {slots.map((slot) => (
                    <DropdownMenuItem
                      key={slot.slotId}
                      onSelect={() => serve(slot.slotId, other.id)}
                    >
                      {liveLabel('serveOnSlot', { port: slot.port, label: slot.label })}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** One project: its ports and the worktrees Sonar has served. */
export function SonarProjectSection({
  section,
  now,
  isVisible
}: {
  section: SonarPanelSection
  now: number
  isVisible: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(section.startsOpen)
  const bodyId = useId()

  return (
    <div>
      <button
        type="button"
        className="sticky top-0 z-10 mb-1 flex w-full items-center gap-1 border-b border-border/40 bg-sidebar px-3 py-1 text-left text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <ChevronRight
          size={12}
          className={cn('shrink-0 transition-transform', open && 'rotate-90')}
        />
        <span className="min-w-0 flex-1 truncate text-3xs font-semibold uppercase tracking-wider">
          {section.name}
        </span>
        <span
          className="shrink-0 text-3xs tabular-nums text-muted-foreground/60"
          aria-label={liveLabel('sectionCountAria', {
            live: section.liveCount,
            total: section.slots.length
          })}
        >
          {liveLabel('sectionCount', { live: section.liveCount, total: section.slots.length })}
        </span>
      </button>
      {open ? (
        <div id={bodyId}>
          {section.slots.map((slot) => (
            <SonarSlotBlock key={slot.slotId} slot={slot} now={now} isVisible={isVisible} />
          ))}
          {section.worktrees.length > 0 ? (
            <>
              <div className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {liveLabel('worktreesTitle')}
              </div>
              <div className="px-1.5">
                {section.worktrees.map((worktree) => (
                  <SonarWorktreeRow
                    key={worktree.id}
                    repoId={section.repoId}
                    worktree={worktree}
                    slots={section.slots}
                  />
                ))}
              </div>
            </>
          ) : null}
          {section.others.length > 0 ? <ServeAnotherMenu section={section} /> : null}
        </div>
      ) : null}
    </div>
  )
}
