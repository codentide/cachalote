import type { LiveSlotRef } from '../../../../shared/cachalote/live/live-ipc'
import type { LiveSlotState } from '../../../../shared/cachalote/live/live-types'
import { splitWorktreeId } from '../../../../shared/worktree/id'

export type LiveGroupSummary = {
  /** Members whose repo has at least one slot. */
  eligible: number
  /** Eligible members a slot is serving with phase `live`. */
  live: number
}

export type LiveGroupProjection =
  | { kind: 'none' }
  | { kind: 'ambiguous' }
  | { kind: 'ready'; assignments: readonly (LiveSlotRef & { worktreeId: string })[] }

function slotsByRepo(slots: readonly LiveSlotState[]): Map<string, LiveSlotState[]> {
  const byRepo = new Map<string, LiveSlotState[]>()
  for (const slot of slots) {
    byRepo.set(slot.repoId, [...(byRepo.get(slot.repoId) ?? []), slot])
  }
  return byRepo
}

function eligibleMembers(
  memberIds: readonly string[],
  byRepo: ReadonlyMap<string, readonly LiveSlotState[]>
): { worktreeId: string; repoId: string }[] {
  const eligible: { worktreeId: string; repoId: string }[] = []
  for (const worktreeId of memberIds) {
    const repoId = splitWorktreeId(worktreeId)?.repoId
    if (repoId !== undefined && byRepo.has(repoId)) {
      eligible.push({ worktreeId, repoId })
    }
  }
  return eligible
}

export function summarizeLiveGroup(
  memberIds: readonly string[],
  slots: readonly LiveSlotState[]
): LiveGroupSummary {
  const eligible = eligibleMembers(memberIds, slotsByRepo(slots))
  const liveIds = new Set(
    slots.filter((slot) => slot.phase === 'live' && slot.worktreeId).map((slot) => slot.worktreeId)
  )
  return {
    eligible: eligible.length,
    live: eligible.filter((member) => liveIds.has(member.worktreeId)).length
  }
}

/**
 * Projects every eligible member only when each goes to one obvious slot: its repo has exactly one
 * slot and no other member shares that repo.
 */
export function planLiveGroupProjection(
  memberIds: readonly string[],
  slots: readonly LiveSlotState[]
): LiveGroupProjection {
  const byRepo = slotsByRepo(slots)
  const eligible = eligibleMembers(memberIds, byRepo)
  if (eligible.length === 0) {
    return { kind: 'none' }
  }
  const repoIds = new Set(eligible.map((member) => member.repoId))
  const sharesRepo = repoIds.size !== eligible.length
  const assignments: (LiveSlotRef & { worktreeId: string })[] = []
  for (const member of eligible) {
    const repoSlots = byRepo.get(member.repoId) ?? []
    const [only] = repoSlots
    if (sharesRepo || !only || repoSlots.length !== 1) {
      return { kind: 'ambiguous' }
    }
    assignments.push({ repoId: only.repoId, slotId: only.slotId, worktreeId: member.worktreeId })
  }
  return { kind: 'ready', assignments }
}
