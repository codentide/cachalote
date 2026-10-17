import type { LiveSlotRef } from '../../../shared/cachalote/live/live-ipc'
import type { LiveProjectConfig, LiveSlotConfig } from '../../../shared/cachalote/live/live-types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function isLiveSlotConfig(value: unknown): value is LiveSlotConfig {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.port === 'number' &&
    typeof value.install === 'string' &&
    typeof value.start === 'string' &&
    isStringArray(value.depsFiles) &&
    isStringArray(value.envFiles)
  )
}

export function isLiveProjectConfig(value: unknown): value is LiveProjectConfig {
  return (
    isRecord(value) &&
    typeof value.repoId === 'string' &&
    Array.isArray(value.slots) &&
    value.slots.every(isLiveSlotConfig)
  )
}

export function isSlotRef(value: unknown): value is LiveSlotRef {
  return isRecord(value) && typeof value.repoId === 'string' && typeof value.slotId === 'string'
}

export function isProjectArgs(value: unknown): value is LiveSlotRef & { worktreeId: string } {
  return isSlotRef(value) && 'worktreeId' in value && typeof value.worktreeId === 'string'
}

export function isLogsArgs(value: unknown): value is LiveSlotRef & { limit?: number } {
  return (
    isSlotRef(value) &&
    (!('limit' in value) ||
      value.limit === undefined ||
      (typeof value.limit === 'number' && Number.isSafeInteger(value.limit)))
  )
}

export function isFreePortArgs(value: unknown): value is { port: number; pid: number } {
  return (
    isRecord(value) &&
    typeof value.port === 'number' &&
    Number.isSafeInteger(value.port) &&
    typeof value.pid === 'number' &&
    Number.isSafeInteger(value.pid)
  )
}

export function isStandbyArgs(value: unknown): value is { repoId: string; worktreeId: string } {
  return isRecord(value) && typeof value.repoId === 'string' && typeof value.worktreeId === 'string'
}
