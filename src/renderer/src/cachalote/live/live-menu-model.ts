import type { LiveSlotState } from '../../../../shared/cachalote/live/live-types'

export type LiveMenuDecision = {
  /** Slots serving the target: one "stop serving" entry each. */
  serving: readonly LiveSlotState[]
  /** Slots the target could take over; a slot serving another worktree counts. */
  projectable: readonly LiveSlotState[]
}

/**
 * What the worktree context menu offers. Null hides the menu: no single target, or its repo has
 * no slots (folder and SSH repos never get any).
 */
export function decideLiveMenu(
  targets: readonly { id: string; repoId: string }[],
  slots: readonly LiveSlotState[]
): LiveMenuDecision | null {
  const [target, ...rest] = targets
  if (!target || rest.length > 0) {
    return null
  }
  const repoSlots = slots.filter((slot) => slot.repoId === target.repoId)
  if (repoSlots.length === 0) {
    return null
  }
  return {
    serving: repoSlots.filter((slot) => slot.worktreeId === target.id),
    projectable: repoSlots.filter((slot) => slot.worktreeId !== target.id)
  }
}
