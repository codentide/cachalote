// Cachalote: Sonar CLI. Here rather than under shared/cachalote because the params catalog
// generator only resolves schemas in this folder.
import { z } from 'zod'
import type { LiveSlotPhase, LiveSlotState } from '../cachalote/live/live-types'
import {
  OptionalBoolean,
  OptionalPositiveInt,
  OptionalString,
  requiredString
} from './rpc-param-primitives'

export const SONAR_DEFAULT_LOG_LINES = 80

export const SonarServe = z.object({
  repoId: requiredString('Missing repo id'),
  slotId: requiredString('Missing slot id'),
  worktreeId: requiredString('Missing worktree id'),
  force: OptionalBoolean
})

export const SonarStop = z.object({
  repoId: requiredString('Missing repo id'),
  slotId: requiredString('Missing slot id'),
  /** The caller's worktree; a slot serving another one is left alone unless `force`. */
  worktreeId: OptionalString,
  force: OptionalBoolean
})

export const SonarLogs = z.object({
  repoId: requiredString('Missing repo id'),
  slotId: requiredString('Missing slot id'),
  limit: OptionalPositiveInt
})

export type SonarSlotStatus = Pick<
  LiveSlotState,
  | 'repoId'
  | 'slotId'
  | 'label'
  | 'port'
  | 'phase'
  | 'worktreeId'
  | 'startedAt'
  | 'error'
  | 'portOwner'
> & {
  url: string
  /** Absolute path of the served worktree; null when idle. */
  worktreePath: string | null
}

export type SonarStatusResult = {
  /** False where Sonar is off (only macOS for now); slots is then empty. */
  supported: boolean
  slots: SonarSlotStatus[]
}

/** The slot serves another worktree, and the caller did not pass `force`. */
export type SonarBusy = { status: 'busy'; worktreeId: string; phase: LiveSlotPhase }

export type SonarServeResult = { status: 'requested' } | SonarBusy

export type SonarStopResult = { status: 'stopped' } | SonarBusy

export type SonarLogsResult = {
  /** Oldest first; empty when the slot has no server terminal. */
  lines: string[]
  truncated: boolean
  phase: LiveSlotPhase
}
