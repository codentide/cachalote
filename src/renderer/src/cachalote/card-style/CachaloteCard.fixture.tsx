import { defineFixture } from '../../component-fixtures/component-fixture'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import WorktreeCard from '@/components/sidebar/workspace-card/surface/WorktreeCard'
import {
  makeWorktree,
  seedWorkspaces,
  type WorkspaceSeed
} from '@/components/sidebar/worktree-card-slot-fixture-seeds'
import { useCachaloteCardStyleStore } from './card-style-store'

const SEEDS: WorkspaceSeed[] = [
  {
    id: 'wt-waiting',
    name: 'sync-resolver-v2',
    agents: [
      { agentType: 'claude', state: 'waiting', minutesAgo: 3, message: 'Aborto el rebase?' }
    ],
    lastActivityMinutesAgo: 3
  },
  {
    id: 'wt-failed',
    name: 'checkout-duplicado',
    agents: [{ agentType: 'codex', state: 'done', minutesAgo: 12, failed: true }],
    lastActivityMinutesAgo: 12
  },
  {
    id: 'wt-working',
    name: 'card-style',
    agents: [
      {
        agentType: 'claude',
        state: 'working',
        minutesAgo: 1,
        toolName: 'Edit',
        toolInput: 'worktree-card-surface.tsx'
      },
      { agentType: 'codex', state: 'done', minutesAgo: 20, message: 'Ran the suite' }
    ],
    lastActivityMinutesAgo: 1,
    pr: { number: 34, state: 'open' }
  },
  {
    id: 'wt-done',
    name: 'ztt-225-tokens',
    agents: [{ agentType: 'claude', state: 'done', minutesAgo: 240, message: 'Migró los tokens' }],
    manualUnread: true,
    lastActivityMinutesAgo: 240
  },
  { id: 'wt-idle', name: 'main', agents: [], lastActivityMinutesAgo: 1500 }
]

const REPOS: Record<string, Repo> = {
  'wt-waiting': {
    id: 'r1',
    path: '/r1',
    displayName: 'cachalote',
    badgeColor: '#22c55e',
    addedAt: 0
  },
  'wt-failed': {
    id: 'r2',
    path: '/r2',
    displayName: 'action-experience-backend',
    badgeColor: '#3b82f6',
    addedAt: 0
  },
  'wt-working': {
    id: 'r1',
    path: '/r1',
    displayName: 'cachalote',
    badgeColor: '#22c55e',
    addedAt: 0
  },
  'wt-done': { id: 'r3', path: '/r3', displayName: 'zitta', badgeColor: '#eab308', addedAt: 0 },
  'wt-idle': { id: 'r4', path: '/r4', displayName: 'kamae', badgeColor: '#f97316', addedAt: 0 }
}

const now = Date.now()
const worktrees: Worktree[] = SEEDS.map((seed) => ({
  ...makeWorktree(seed, now),
  ...(seed.id === 'wt-idle' ? { isMainWorktree: true, branch: 'main' } : {})
}))

export const cards = defineFixture({
  width: 320,
  setup: () => {
    seedWorkspaces(SEEDS, now)
    useCachaloteCardStyleStore.setState({ cachaloteCards: true })
  },
  render: () => (
    <div className="flex flex-col gap-1 bg-worktree-sidebar py-1.5 text-worktree-sidebar-foreground">
      {worktrees.map((worktree) => (
        <WorktreeCard
          key={worktree.id}
          worktree={worktree}
          repo={REPOS[worktree.id]}
          isActive={worktree.id === 'wt-working'}
          contentIndent={20}
          flushSurface
          nativeDragEnabled={false}
        />
      ))}
    </div>
  )
})
