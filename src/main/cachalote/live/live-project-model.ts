import path from 'node:path'
import type { Repo } from '../../../shared/repo-types'
import { isFolderRepo } from '../../../shared/repo-kind'
import { liveSeedFor } from '../../../shared/cachalote/live/live-seeds'
import type {
  LiveConfigEntry,
  LiveProjectConfig,
  LiveSlotConfig,
  LiveSlotState
} from '../../../shared/cachalote/live/live-types'
import type { LiveSlotRef } from '../../../shared/cachalote/live/live-ipc'
import { splitWorktreeId } from '../../../shared/worktree/id'
import type { SyncResult } from './live-sync'

/** Projects may share a port: these other slots serve it now, so the one about to serve stops them. */
export function slotsHoldingPort(
  slots: readonly LiveSlotState[],
  self: LiveSlotRef,
  port: number
): LiveSlotState[] {
  return slots.filter(
    (other) =>
      other.port === port &&
      other.worktreeId !== null &&
      !(other.repoId === self.repoId && other.slotId === self.slotId)
  )
}

/** Local git repos only: SSH, runtime-hosted and folder projects have no runner to build here. */
export function isLiveEligibleRepo(repo: Repo): boolean {
  return (
    !repo.connectionId &&
    !isFolderRepo(repo) &&
    (!repo.executionHostId || repo.executionHostId === 'local')
  )
}

/** Saved config, else the seed by sidebar name. */
export function effectiveLiveConfig(
  repo: Repo,
  saved: LiveProjectConfig | null
): LiveConfigEntry | null {
  if (saved) {
    return { config: saved, source: 'saved' }
  }
  const seed = liveSeedFor(repo.id, repo.displayName)
  return seed ? { config: seed, source: 'seed' } : null
}

export function sanitizeRunnerName(displayName: string): string {
  const cleaned = displayName
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  return cleaned || 'project'
}

/** `~/orca/live/<project>/<slot>`; two projects sharing a name get their id appended so runners never collide. */
export function liveRunnerPath(
  homeDir: string,
  repo: Repo,
  allRepos: readonly Repo[],
  slotId: string
): string {
  const name = sanitizeRunnerName(repo.displayName)
  const clash = allRepos.some(
    (other) =>
      other.id !== repo.id &&
      isLiveEligibleRepo(other) &&
      sanitizeRunnerName(other.displayName) === name
  )
  const folder = clash ? `${name}-${repo.id.slice(0, 8)}` : name
  return path.join(homeDir, 'orca', 'live', folder, slotId)
}

/** The checkout path a worktree id names, when it belongs to `repoId`. */
export function worktreePathForRepo(repoId: string, worktreeId: string): string | null {
  const parsed = splitWorktreeId(worktreeId)
  return parsed && parsed.repoId === repoId && path.isAbsolute(parsed.worktreePath)
    ? parsed.worktreePath
    : null
}

export function normalizeLiveConfig(config: LiveProjectConfig): LiveProjectConfig {
  return {
    repoId: config.repoId,
    slots: config.slots.map((slot): LiveSlotConfig => ({
      id: slot.id.trim(),
      label: slot.label.trim(),
      port: slot.port,
      install: slot.install.trim(),
      start: slot.start.trim(),
      depsFiles: slot.depsFiles.map((file) => file.trim()),
      envFiles: slot.envFiles.map((file) => file.trim())
    }))
  }
}

/** A change that needs a new server process: port, install or start. */
export function slotNeedsRestart(before: LiveSlotConfig, after: LiveSlotConfig): boolean {
  return (
    before.port !== after.port || before.install !== after.install || before.start !== after.start
  )
}

function cleanRelativePath(file: string): string {
  return path.posix.normalize(file.trim())
}

/** Whether a sync wrote or removed one of the slot's dependency files. */
export function touchesDepsFiles(result: SyncResult, depsFiles: readonly string[]): boolean {
  const watched = new Set(depsFiles.map(cleanRelativePath))
  return [...result.written, ...result.removed].some((changed) => watched.has(changed))
}
