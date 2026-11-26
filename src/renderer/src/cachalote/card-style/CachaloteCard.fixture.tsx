import { defineFixture } from '../../component-fixtures/component-fixture'
import { useAppStore } from '@/store'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import WorktreeCard from '@/components/sidebar/workspace-card/surface/WorktreeCard'
import {
  makeWorktree,
  seedWorkspaces,
  type WorkspaceSeed
} from '@/components/sidebar/worktree-card-slot-fixture-seeds'
import { useCachaloteCardStyleStore } from './card-style-store'
import {
  getWorktreeCardContentIndent,
  getWorktreeCardSurfaceInset
} from '@/components/sidebar/worktree-list/rows/indentation'
import { WorktreeGroupRow } from '../worktree-groups/WorktreeGroupRow'
import {
  folderMemberIds,
  folderMemberPositions,
  useWorktreeGroupFolderMembers
} from '../worktree-groups/worktree-group-folder-members'

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
  { id: 'wt-idle', name: 'main', agents: [], lastActivityMinutesAgo: 1500 },
  {
    id: 'wt-mongo',
    name: 'AX-3846',
    agents: [
      { agentType: 'claude', state: 'working', minutesAgo: 36, toolName: 'mcp__mongodb__aggregate' }
    ],
    lastActivityMinutesAgo: 36
  }
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
  'wt-idle': { id: 'r4', path: '/r4', displayName: 'kamae', badgeColor: '#f97316', addedAt: 0 },
  'wt-mongo': {
    id: 'r5',
    path: '/r5',
    displayName: 'ax-backend',
    badgeColor: '#eab308',
    addedAt: 0
  }
}

const now = Date.now()
const worktrees: Worktree[] = SEEDS.map((seed) => ({
  ...makeWorktree(seed, now),
  ...(seed.id === 'wt-idle' ? { isMainWorktree: true, branch: 'main' } : {}),
  ...(seed.id === 'wt-mongo' ? { branch: 'AX-3845' } : {})
}))

export const cards = defineFixture({
  width: 320,
  setup: () => {
    seedWorkspaces(SEEDS, now)
    useCachaloteCardStyleStore.setState({ cachaloteCards: true })
    // 'unknown' must stay hidden, as upstream's label does; 'rebase' shows its tag.
    useAppStore.setState({
      gitConflictOperationByWorktree: { 'wt-mongo': 'unknown', 'wt-failed': 'rebase' }
    })
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

const GROUP_MEMBERS = ['wt-waiting', 'wt-failed', 'wt-working', 'wt-asleep']
// No tabs or agents seeded, so the sidebar treats it as asleep.
const ASLEEP: Worktree = {
  ...makeWorktree(
    { id: 'wt-asleep', name: 'ax-3846', agents: [], lastActivityMinutesAgo: 1020 },
    now
  ),
  branch: 'AX-3845'
}
const GROUP_DEPTH = 1
const memberIndent = getWorktreeCardContentIndent({
  isGrouped: true,
  groupDepth: GROUP_DEPTH,
  lineageDepth: 1
})
const memberInset = getWorktreeCardSurfaceInset({ isGrouped: true, groupDepth: GROUP_DEPTH })

export const groupTree = defineFixture({
  width: 320,
  setup: () => {
    seedWorkspaces(SEEDS, now)
    useCachaloteCardStyleStore.setState({ cachaloteCards: true })
    const rows = [
      {
        type: 'cachalote-worktree-group',
        groupId: 'g1',
        collapsed: false,
        worktreeIds: GROUP_MEMBERS
      }
    ]
    useWorktreeGroupFolderMembers
      .getState()
      .publish(folderMemberIds(rows), folderMemberPositions(rows))
  },
  render: () => (
    <div className="flex flex-col bg-worktree-sidebar py-1.5 text-worktree-sidebar-foreground">
      <WorktreeGroupRow
        isGrouped
        row={{
          type: 'cachalote-worktree-group',
          key: 's:g1',
          sectionKey: 's',
          groupId: 'g1',
          name: 'Eventos',
          color: undefined,
          icon: undefined,
          count: GROUP_MEMBERS.length,
          collapsed: false,
          groupDepth: GROUP_DEPTH,
          worktreeIds: GROUP_MEMBERS,
          memberHostKeys: GROUP_MEMBERS
        }}
      />
      {[...worktrees, ASLEEP]
        .filter((worktree) => GROUP_MEMBERS.includes(worktree.id))
        .map((worktree) => (
          // The sidebar's virtual rows pad 6px below each card (lineage frame `after`).
          <div key={worktree.id} style={{ paddingLeft: memberInset, paddingBottom: 6 }}>
            <WorktreeCard
              worktree={worktree}
              repo={REPOS[worktree.id] ?? REPOS['wt-failed']}
              isActive={worktree.id === 'wt-working'}
              contentIndent={memberIndent - memberInset}
              flushSurface
              nativeDragEnabled={false}
            />
          </div>
        ))}
    </div>
  )
})
