import React from 'react'
import { GitBranch, GitFork, GitMerge, GitPullRequest, House, Moon, Server } from 'lucide-react'

import { cn } from '@/lib/class-names'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useNow } from '@/lib/window-activity/use-now'
import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import type { WorktreeCardController } from '@/components/sidebar/workspace-card/controller/use-worktree-card-controller'
import { getCompactAgentSecondary } from '@/components/sidebar/workspace-card/activity/worktree-card-compact-agent-row'
import { useWorktreeCardRolledUpUnread } from '@/components/sidebar/workspace-card/surface/worktree-card-title-status'
import { resolveRepoHeaderColor } from '@/components/sidebar/worktree-list/rows/project-header-color'
import { conflictOperationLabel } from '@/components/sidebar/workspace-card/metadata/worktree-conflict-label'
import { useIsSleepingWorktree } from '@/components/sidebar/workspace-actions/sleep/use-worktree-sleep-state'
import { pickCardLeadAgent } from './card-lead-agent'
import { cardStyleLabel } from './card-style-labels'
import { CardStateIcon } from './CardStateIcon'
import { WorktreeGroupTreeGuide } from '../worktree-groups/worktree-group-tree-guide'
import { useWorktreeGroupFolderMembers } from '../worktree-groups/worktree-group-folder-members'
import './cachalote-card.css'

const TAG_CLASS_NAME =
  'inline-flex h-4 shrink-0 items-center gap-0.5 rounded-[4px] border border-worktree-sidebar-border px-1 text-3xs text-muted-foreground [&_svg]:size-[11px]'

function ProjectBadge({
  name,
  badgeColor
}: {
  name: string
  badgeColor: string
}): React.JSX.Element {
  const color = resolveRepoHeaderColor(badgeColor)
  return (
    <span
      className="h-[17px] max-w-[110px] shrink-0 truncate rounded-[4px] px-[7px] text-2xs leading-[17px] font-semibold"
      // The project's hue on a translucent fill; text mixes toward the theme foreground to stay legible.
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
        color: `color-mix(in srgb, ${color} 55%, var(--foreground))`
      }}
      title={name}
    >
      {name}
    </span>
  )
}

/** A one-icon badge the height of the project badge: primary worktree, asleep. */
function IconBadge({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <span
      className="inline-grid h-[17px] w-[19px] shrink-0 place-items-center rounded-[4px] bg-worktree-sidebar-accent text-muted-foreground"
      title={label}
      aria-label={label}
    >
      {children}
    </span>
  )
}

function reviewTagClassName(status: string | undefined): string {
  if (status === 'success') {
    return 'text-emerald-500'
  }
  return status === 'failure' ? 'text-red-500' : ''
}

// Upstream's label: an operation git can't name ('unknown') shows nothing, as on its own cards.
function cardConflictLabel(card: WorktreeCardController): string {
  return card.conflictOperation ? conflictOperationLabel(card.conflictOperation) : ''
}

function ReviewTags({ card }: { card: WorktreeCardController }): React.JSX.Element | null {
  const { prDisplay, lineageChildCount } = card
  const conflictLabel = cardConflictLabel(card)
  if (!prDisplay && !conflictLabel && lineageChildCount === 0) {
    return null
  }
  return (
    <>
      {conflictLabel ? (
        <span className={cn(TAG_CLASS_NAME, 'text-destructive')}>
          <GitMerge />
          {conflictLabel}
        </span>
      ) : null}
      {prDisplay ? (
        <span
          className={cn(TAG_CLASS_NAME, reviewTagClassName(prDisplay.status))}
          title={prDisplay.title}
        >
          <GitPullRequest />
          {prDisplay.number}
        </span>
      ) : null}
      {lineageChildCount > 0 ? (
        <span className={TAG_CLASS_NAME} title={cardStyleLabel('childWorktrees')}>
          <GitFork />
          {lineageChildCount}
        </span>
      ) : null}
    </>
  )
}

function ActivityTime({
  at,
  now,
  unread
}: {
  at: number
  now: number
  unread: boolean
}): React.JSX.Element | null {
  return at > 0 ? (
    <span
      className={cn(
        'shrink-0 text-2xs tabular-nums',
        unread ? 'font-semibold text-unread' : 'text-muted-foreground/70'
      )}
    >
      {formatShortTimeAgo(at, now)}
    </span>
  ) : null
}

const CARD_BOX_CLASS_NAME =
  'flex min-w-0 flex-1 flex-col gap-[5px] rounded-lg border border-transparent p-2.5 transition-[background-color,border-color] duration-200'

/** Cachalote's card: project, branch and time; the name; the lead agent's state. */
export function CachaloteCardContent({
  card
}: {
  card: WorktreeCardController
}): React.JSX.Element {
  const { worktree, repo, branch } = card
  const now = useNow(30_000)
  const unread = useWorktreeCardRolledUpUnread()
  const asleep = useIsSleepingWorktree(worktree.id)
  const lead = pickCardLeadAgent(card.inlineAgentRows)
  const title = card.visibleCardTitle
  const showBranch = branch.length > 0 && branch !== title
  const hostLabel = card.hostContextLabel
  const quiet = (asleep || lead === null || lead.state === 'idle') && !card.isActiveSurface
  // Room for the folder's tree guide to branch into the card.
  const inFolder = useWorktreeGroupFolderMembers((s) => s.positions.has(worktree.id))
  const boxClassName = cn(CARD_BOX_CLASS_NAME, quiet && 'opacity-55', inFolder && 'ml-2.5')
  const projectBadge = repo ? (
    <ProjectBadge name={repo.displayName} badgeColor={repo.badgeColor} />
  ) : null
  const unreadDot = unread ? (
    <span className="size-[7px] shrink-0 rounded-full bg-unread" title={cardStyleLabel('unread')} />
  ) : null

  // Asleep: one line, so idle worktrees take little room until they wake.
  if (asleep && !card.isActiveSurface) {
    return (
      <div data-cachalote-card="" className={cn(boxClassName, 'py-1.5')}>
        <WorktreeGroupTreeGuide worktreeId={worktree.id} />
        <div className="flex min-w-0 items-center gap-1.5">
          {projectBadge}
          <span className="min-w-0 flex-1 truncate text-xs font-semibold" title={title}>
            {title}
          </span>
          {unreadDot}
          <IconBadge label={cardStyleLabel('asleep')}>
            <Moon className="size-[11px]" />
          </IconBadge>
          <ActivityTime at={worktree.lastActivityAt} now={now} unread={unread} />
        </div>
      </div>
    )
  }

  const tags = <ReviewTags card={card} />
  const hasTags = Boolean(card.prDisplay || cardConflictLabel(card) || card.lineageChildCount > 0)
  const showLead = lead !== null && lead.state !== 'idle'

  return (
    <div data-cachalote-card="" className={boxClassName}>
      <WorktreeGroupTreeGuide worktreeId={worktree.id} />
      <div className="flex min-w-0 items-center gap-1.5">
        {projectBadge}
        {worktree.isMainWorktree ? (
          <IconBadge label={cardStyleLabel('primary')}>
            <House className="size-[11px]" />
          </IconBadge>
        ) : null}
        {showBranch ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex h-[17px] min-w-0 items-center gap-1 rounded-[4px] bg-worktree-sidebar-accent px-1.5 text-muted-foreground">
                <GitBranch className="size-[11px] shrink-0" />
                <span className="truncate font-mono text-3xs">{branch}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              <span className="font-mono">{branch}</span>
            </TooltipContent>
          </Tooltip>
        ) : null}
        {hostLabel ? (
          <span className={TAG_CLASS_NAME}>
            <Server />
            {hostLabel}
          </span>
        ) : null}
        <span className="min-w-1 flex-1" />
        {unreadDot}
        <ActivityTime at={worktree.lastActivityAt} now={now} unread={unread} />
      </div>

      <div className="truncate text-[13px] leading-5 font-semibold" title={title}>
        {title}
      </div>

      {showLead || hasTags ? (
        <div className="flex min-w-0 items-center gap-1.5">
          {showLead ? (
            <>
              <CardStateIcon state={lead.state} />
              <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
                {getCompactAgentSecondary(lead.agent, now)}
              </span>
            </>
          ) : (
            <span className="flex-1" />
          )}
          {tags}
          {showLead && lead.othersCount > 0 ? (
            <span
              className="shrink-0 rounded-full bg-worktree-sidebar-accent px-1.5 text-3xs text-muted-foreground"
              title={cardStyleLabel('otherAgents')}
            >
              +{lead.othersCount}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
