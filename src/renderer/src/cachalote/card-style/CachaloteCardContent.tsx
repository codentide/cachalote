import React from 'react'
import { GitBranch, GitFork, GitMerge, GitPullRequest, House, Server } from 'lucide-react'

import { cn } from '@/lib/class-names'
import { useNow } from '@/lib/window-activity/use-now'
import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import type { WorktreeCardController } from '@/components/sidebar/workspace-card/controller/use-worktree-card-controller'
import { getCompactAgentSecondary } from '@/components/sidebar/workspace-card/activity/worktree-card-compact-agent-row'
import { useWorktreeCardRolledUpUnread } from '@/components/sidebar/workspace-card/surface/worktree-card-title-status'
import { resolveRepoHeaderColor } from '@/components/sidebar/worktree-list/rows/project-header-color'
import { pickCardLeadAgent } from './card-lead-agent'
import { cardStyleLabel } from './card-style-labels'
import { CardStateIcon } from './CardStateIcon'
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
      className="h-[17px] max-w-[110px] min-w-0 truncate rounded-[4px] px-[7px] text-2xs leading-[17px] font-semibold"
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

function reviewTagClassName(status: string | undefined): string {
  if (status === 'success') {
    return 'text-emerald-500'
  }
  return status === 'failure' ? 'text-red-500' : ''
}

/** Cachalote's card: project, worktree, branch and the lead agent's state, one per line. */
export function CachaloteCardContent({
  card
}: {
  card: WorktreeCardController
}): React.JSX.Element {
  const { worktree, repo, branch, prDisplay, conflictOperation, lineageChildCount } = card
  const now = useNow(30_000)
  const unread = useWorktreeCardRolledUpUnread()
  const lead = pickCardLeadAgent(card.inlineAgentRows)
  const title = card.visibleCardTitle
  const showBranch = branch.length > 0 && branch !== title
  const hostLabel = card.hostContextLabel
  const quiet = (lead === null || lead.state === 'idle') && !card.isActiveSurface

  return (
    <div
      data-cachalote-card=""
      className={cn('flex min-w-0 flex-1 flex-col gap-[5px] py-0.5 pl-1.5', quiet && 'opacity-55')}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {repo ? <ProjectBadge name={repo.displayName} badgeColor={repo.badgeColor} /> : null}
        {worktree.isMainWorktree ? (
          <span
            className="inline-grid h-[17px] w-[19px] shrink-0 place-items-center rounded-[4px] bg-worktree-sidebar-accent text-muted-foreground"
            title={cardStyleLabel('primary')}
          >
            <House className="size-[11px]" />
          </span>
        ) : null}
        {hostLabel ? (
          <span className={TAG_CLASS_NAME}>
            <Server />
            {hostLabel}
          </span>
        ) : null}
        {unread ? <span className="size-[7px] shrink-0 rounded-full bg-unread" /> : null}
        <span className="flex-1" />
        {worktree.lastActivityAt > 0 ? (
          <span className="shrink-0 text-2xs text-muted-foreground/70 tabular-nums">
            {formatShortTimeAgo(worktree.lastActivityAt, now)}
          </span>
        ) : null}
      </div>

      <div className="truncate text-[13px] leading-5 font-semibold" title={title}>
        {title}
      </div>

      {showBranch || prDisplay || conflictOperation || lineageChildCount > 0 ? (
        <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          {showBranch ? (
            <>
              <GitBranch className="size-3 shrink-0 text-muted-foreground/70" />
              <span className="min-w-0 truncate font-mono text-2xs" title={branch}>
                {branch}
              </span>
            </>
          ) : null}
          <span className="flex-1" />
          {conflictOperation ? (
            <span className={cn(TAG_CLASS_NAME, 'text-destructive')}>
              <GitMerge />
              {conflictOperation}
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
        </div>
      ) : null}

      {lead && lead.state !== 'idle' ? (
        <div className="flex min-w-0 items-center gap-1.5">
          <CardStateIcon state={lead.state} />
          <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
            {getCompactAgentSecondary(lead.agent, now)}
          </span>
          {lead.othersCount > 0 ? (
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
