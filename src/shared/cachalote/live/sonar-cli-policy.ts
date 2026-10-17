// Sonar CLI rules shared by the runtime (conflicts) and the `orca sonar` handlers (slot choice, waiting).
import type { SonarBusy, SonarSlotStatus } from '../../rpc-contract/cachalote-sonar-params'
import type { LiveSlotState } from './live-types'

export type SonarSlotQuery = {
  repoId: string
  /** The caller's worktree; null when the command runs outside one. */
  worktreeId: string | null
  port?: number
  slotId?: string
  /** logs and stop: the slot already serving the caller's worktree wins over ambiguity. */
  preferServing?: boolean
}

export type SonarSlotChoice =
  | { ok: true; slot: SonarSlotStatus }
  | { ok: false; reason: 'no-slots' | 'no-match' | 'ambiguous'; ports: number[] }

/** The slot of the caller's project a command acts on. */
export function pickSonarSlot(
  slots: readonly SonarSlotStatus[],
  query: SonarSlotQuery
): SonarSlotChoice {
  const candidates = slots.filter((slot) => slot.repoId === query.repoId)
  const ports = candidates.map((slot) => slot.port)
  if (candidates.length === 0) {
    return { ok: false, reason: 'no-slots', ports }
  }
  if (query.port !== undefined || query.slotId !== undefined) {
    const match = candidates.find(
      (slot) =>
        (query.port === undefined || slot.port === query.port) &&
        (query.slotId === undefined || slot.slotId === query.slotId)
    )
    return match ? { ok: true, slot: match } : { ok: false, reason: 'no-match', ports }
  }
  if (query.preferServing && query.worktreeId) {
    const serving = candidates.find(
      (slot) => slot.worktreeId === query.worktreeId && slot.phase !== 'idle'
    )
    if (serving) {
      return { ok: true, slot: serving }
    }
  }
  return candidates.length === 1
    ? { ok: true, slot: candidates[0] }
    : { ok: false, reason: 'ambiguous', ports }
}

/** Agents share ports: one never takes a slot another worktree holds unless it says `force`. */
export function sonarConflict(
  slot: Pick<LiveSlotState, 'worktreeId' | 'phase'>,
  callerWorktreeId: string | null,
  force: boolean
): SonarBusy | null {
  if (force || slot.worktreeId === null || slot.phase === 'idle') {
    return null
  }
  return slot.worktreeId === callerWorktreeId
    ? null
    : { status: 'busy', worktreeId: slot.worktreeId, phase: slot.phase }
}

export type SonarServeProgress =
  | { kind: 'live' }
  | { kind: 'pending' }
  | {
      kind: 'failed'
      /** lost: the slot no longer serves the caller (its sync failed, or someone took it). */
      reason: 'crashed' | 'port-busy' | 'lost'
      error: string | null
      portOwner: SonarSlotStatus['portOwner']
    }

/**
 * Where a `serve` stands, read from a status poll. Reliable from the first poll: the runtime marks
 * the slot as serving the caller and syncing before `sonar.serve` returns.
 */
export function sonarServeProgress(
  slot: SonarSlotStatus | undefined,
  callerWorktreeId: string
): SonarServeProgress {
  if (!slot || slot.worktreeId !== callerWorktreeId) {
    return { kind: 'failed', reason: 'lost', error: slot?.error ?? null, portOwner: null }
  }
  if (slot.phase === 'live') {
    return { kind: 'live' }
  }
  if (slot.phase === 'crashed' || slot.phase === 'port-busy') {
    return { kind: 'failed', reason: slot.phase, error: slot.error, portOwner: slot.portOwner }
  }
  return { kind: 'pending' }
}
