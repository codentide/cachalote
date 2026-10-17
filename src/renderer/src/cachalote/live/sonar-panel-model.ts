import type { LiveSlotState } from '../../../../shared/cachalote/live/live-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'

export type SonarPanelWorktree = {
  id: string
  name: string
  isMain: boolean
  /** Slots of this project currently serving the worktree. */
  servingSlotIds: string[]
  /** Put live before and not served now: the row can be taken off the list. */
  standby: boolean
}

/** A worktree never put live, offered by the panel's "serve another worktree" menu. */
export type SonarPanelOtherWorktree = Pick<SonarPanelWorktree, 'id' | 'name' | 'isMain'>

export type SonarPanelSection = {
  repoId: string
  name: string
  /** Sorted by port. */
  slots: LiveSlotState[]
  /**
   * Only the worktrees Sonar has served: the live ones and the standby list. Main worktree first,
   * then by name; stable while serving changes so rows never jump.
   */
  worktrees: SonarPanelWorktree[]
  /** The project's other worktrees, same order, for the "serve another worktree" menu. */
  others: SonarPanelOtherWorktree[]
  liveCount: number
  /** Expanded on first render: the active worktree's project, or one with a slot in use. */
  startsOpen: boolean
}

export type SonarPanelInput = {
  repos: readonly Repo[]
  worktreesByRepo: Readonly<Record<string, readonly Worktree[]>>
  slotsByRepo: Readonly<Record<string, readonly LiveSlotState[]>>
  standbyByRepo: Readonly<Record<string, readonly string[]>>
  activeWorktreeId: string | null
}

function worktreeName(worktree: Worktree): string {
  return worktree.displayName || worktree.path.split(/[\\/]/).pop() || worktree.path
}

function compareWorktrees(a: SonarPanelOtherWorktree, b: SonarPanelOtherWorktree): number {
  if (a.isMain !== b.isMain) {
    return a.isMain ? -1 : 1
  }
  return a.name.localeCompare(b.name)
}

/** Projects with Sonar ports, the active worktree's first, each with the worktrees it can serve. */
export function buildSonarPanelSections(input: SonarPanelInput): SonarPanelSection[] {
  const activeRepoId =
    input.activeWorktreeId === null
      ? null
      : (Object.entries(input.worktreesByRepo).find(([, worktrees]) =>
          worktrees.some((worktree) => worktree.id === input.activeWorktreeId)
        )?.[0] ?? null)

  const sections = Object.entries(input.slotsByRepo).flatMap(([repoId, repoSlots]) => {
    const repo = input.repos.find((candidate) => candidate.id === repoId)
    if (!repo || repoSlots.length === 0) {
      return []
    }
    const slots = [...repoSlots].sort((a, b) => a.port - b.port)
    const standby = new Set(input.standbyByRepo[repoId] ?? [])
    const worktrees: SonarPanelWorktree[] = []
    const others: SonarPanelOtherWorktree[] = []
    for (const worktree of input.worktreesByRepo[repoId] ?? []) {
      if (worktree.isArchived || worktree.removing) {
        continue
      }
      const base = {
        id: worktree.id,
        name: worktreeName(worktree),
        isMain: worktree.isMainWorktree
      }
      const servingSlotIds = slots
        .filter((slot) => slot.worktreeId === worktree.id)
        .map((slot) => slot.slotId)
      if (servingSlotIds.length > 0 || standby.has(worktree.id)) {
        worktrees.push({ ...base, servingSlotIds, standby: servingSlotIds.length === 0 })
      } else {
        others.push(base)
      }
    }
    worktrees.sort(compareWorktrees)
    others.sort(compareWorktrees)
    return [
      {
        repoId,
        name: repo.displayName,
        slots,
        worktrees,
        others,
        liveCount: slots.filter((slot) => slot.phase === 'live').length,
        startsOpen: repoId === activeRepoId || slots.some((slot) => slot.phase !== 'idle')
      }
    ]
  })

  return sections.sort((a, b) => {
    const aActive = a.repoId === activeRepoId
    if (aActive !== (b.repoId === activeRepoId)) {
      return aActive ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
}
