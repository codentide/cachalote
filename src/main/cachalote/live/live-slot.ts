import { mkdir } from 'node:fs/promises'
import type { LiveSlotRef } from '../../../shared/cachalote/live/live-ipc'
import type { LiveSlotConfig } from '../../../shared/cachalote/live/live-types'
import type { SonarLogsResult } from '../../../shared/rpc-contract/cachalote-sonar-params'
import { linkEnvFiles } from './live-env-links'
import { touchesDepsFiles } from './live-project-model'
import { buildServerCommand, LiveSlotServer } from './live-server'
import type {
  LiveServerDeps,
  ServerPhase,
  ServerState,
  ServerTerminal
} from './live-server-contract'
import { PendingDelta } from './live-pending-delta'
import { LiveSlotQueue } from './live-slot-queue'
import {
  deltaSync,
  fullSync,
  type LiveManifest,
  type SyncResult,
  type SyncTarget
} from './live-sync'
import type { LiveWatchHandle, WatchedEvents, watchWorktree } from './live-watch'

/** Everything a slot operation needs from the project's current config. */
export type SlotResolution = {
  slot: LiveSlotConfig
  repoPath: string
  runnerRoot: string
  terminalSelector: string
}

export type LiveSlotDeps = {
  server: LiveServerDeps
  watch: typeof watchWorktree
}

export type LiveSlotHooks = { changed: () => void; persist: () => void }

export type LiveSlotView = {
  worktreeId: string | null
  phase: ServerPhase | 'syncing'
  error: string | null
  server: ServerState
}

function messageOf(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? 'unknown error'
}

function mergeResults(first: SyncResult, second: SyncResult): SyncResult {
  return {
    written: [...first.written, ...second.written],
    removed: [...first.removed, ...second.removed],
    errors: [...first.errors, ...second.errors]
  }
}

/** One slot: the runner's manifest, the watch on the served worktree and the server, behind one queue. */
export class LiveSlot {
  readonly queue = new LiveSlotQueue()
  readonly server: LiveSlotServer
  readonly manifest: LiveManifest
  worktreeId: string | null
  private syncing = false
  private recovering: boolean
  private error: string | null = null
  private watch: LiveWatchHandle | null = null
  private watchedPath: string | null = null
  private pending = new PendingDelta()
  private worktreePath: string | null = null

  constructor(
    readonly ref: LiveSlotRef,
    private readonly deps: LiveSlotDeps,
    private readonly resolve: () => SlotResolution | null,
    private readonly hooks: LiveSlotHooks,
    restored: { worktreeId: string | null; manifest: LiveManifest; recovering: boolean }
  ) {
    this.worktreeId = restored.worktreeId
    this.manifest = restored.manifest
    this.recovering = restored.recovering
    let last: SlotResolution | null = null
    this.server = new LiveSlotServer(
      deps.server,
      () => {
        last = this.resolve() ?? last
        if (!last) {
          throw new Error('slot configuration is gone')
        }
        return {
          port: last.slot.port,
          runnerPath: last.runnerRoot,
          terminalSelector: last.terminalSelector
        }
      },
      () => {
        this.hooks.changed()
        this.hooks.persist()
      }
    )
  }

  view(): LiveSlotView {
    const server = this.server.getState()
    return {
      worktreeId: this.worktreeId,
      phase: this.syncing || this.recovering ? 'syncing' : server.phase,
      error: this.error ?? server.error,
      server
    }
  }

  /** Records the request at once so the UI reacts, then queues the work; a newer request replaces it. */
  requestProject(worktreeId: string, worktreePath: string): Promise<boolean> {
    this.worktreeId = worktreeId
    this.worktreePath = worktreePath
    this.syncing = true
    this.recovering = false
    this.error = null
    this.hooks.changed()
    return this.queue.enqueue('project', () => this.runProject(worktreePath), { supersede: true })
  }

  requestStop(): Promise<boolean> {
    return this.queue.enqueue('stop', () => this.runStop(), { supersede: true })
  }

  async readLogs(limit: number): Promise<SonarLogsResult> {
    const { phase } = this.view()
    const logs = await this.server.readLogs(limit).catch(() => null)
    return { lines: logs?.lines ?? [], truncated: logs?.truncated ?? false, phase }
  }

  /** Re-attaches a slot that was serving before a restart; never starts a server by itself. */
  requestRecovery(
    worktreePath: string,
    terminal: ServerTerminal | null,
    startedAt: number | null
  ): Promise<boolean> {
    // A request made while the runtime was still starting wins over the persisted state.
    if (!this.recovering) {
      return Promise.resolve(false)
    }
    this.worktreePath = worktreePath
    return this.queue.enqueue('recover', () => this.runRecovery(terminal, startedAt), {
      supersede: true
    })
  }

  /** Re-runs the server start after its port was freed. */
  requestServerStart(): Promise<boolean> {
    return this.queue.enqueue('start', async () => {
      const resolution = this.resolve()
      if (resolution && this.worktreeId && !this.server.isRunning) {
        await this.server.start(buildServerCommand(resolution.slot.install, resolution.slot.start))
      }
    })
  }

  dispose(): void {
    this.server.dispose()
    void this.stopWatch()
  }

  private target(resolution: SlotResolution, worktreePath: string): SyncTarget {
    return { worktreePath, runnerRoot: resolution.runnerRoot, manifest: this.manifest }
  }

  private async syncAndLink(resolution: SlotResolution, worktreePath: string): Promise<SyncResult> {
    await mkdir(resolution.runnerRoot, { recursive: true })
    await this.ensureWatch(worktreePath)
    const result = await fullSync(this.target(resolution, worktreePath))
    await linkEnvFiles({
      repoPath: resolution.repoPath,
      runnerRoot: resolution.runnerRoot,
      globs: resolution.slot.envFiles
    })
    if (result.errors.length > 0) {
      this.error = `${result.errors.length} file(s) could not be copied: ${result.errors[0]}`
    }
    return result
  }

  private async restartWithInstall(slot: LiveSlotConfig): Promise<void> {
    await this.server.stop()
    await this.server.start(buildServerCommand(slot.install, slot.start))
  }

  private async runProject(worktreePath: string): Promise<void> {
    const resolution = this.resolve()
    try {
      if (!resolution) {
        throw new Error('slot configuration is gone')
      }
      const result = await this.syncAndLink(resolution, worktreePath)
      const { slot } = resolution
      if (this.server.isRunning) {
        if (touchesDepsFiles(result, slot.depsFiles)) {
          await this.restartWithInstall(slot)
        }
      } else {
        // A leftover pane from a crash goes before the new one starts.
        if (this.server.getState().phase !== 'idle') {
          await this.server.stop()
        }
        await this.server.start(buildServerCommand(slot.install, slot.start))
      }
    } catch (error) {
      this.error = messageOf(error)
      if (!this.server.isRunning) {
        this.worktreeId = null
      }
    } finally {
      this.syncing = false
      this.hooks.changed()
      this.hooks.persist()
    }
  }

  private async runRecovery(
    terminal: ServerTerminal | null,
    startedAt: number | null
  ): Promise<void> {
    const resolution = this.resolve()
    try {
      if (!resolution || !this.worktreePath) {
        throw new Error('slot configuration is gone')
      }
      let result: SyncResult = { written: [], removed: [], errors: [] }
      try {
        result = await this.syncAndLink(resolution, this.worktreePath)
      } catch (error) {
        // The worktree may be gone; the server is still worth re-attaching so Stop works.
        this.error = messageOf(error)
      }
      await this.server.restore(terminal, startedAt)
      if (this.server.isRunning && touchesDepsFiles(result, resolution.slot.depsFiles)) {
        await this.restartWithInstall(resolution.slot)
      }
    } catch (error) {
      this.error = messageOf(error)
    } finally {
      this.recovering = false
      this.hooks.changed()
      this.hooks.persist()
    }
  }

  private async runStop(): Promise<void> {
    try {
      await this.stopWatch()
      await this.server.stop()
    } catch (error) {
      this.error = messageOf(error)
    } finally {
      this.worktreeId = null
      this.worktreePath = null
      this.syncing = false
      this.recovering = false
      this.pending = new PendingDelta()
      this.hooks.changed()
      this.hooks.persist()
    }
  }

  private async ensureWatch(worktreePath: string): Promise<void> {
    if (this.watch && this.watchedPath === worktreePath) {
      return
    }
    await this.stopWatch()
    try {
      this.watch = await this.deps.watch(worktreePath, {
        onEvents: (events) => this.onWatchEvents(events),
        onResync: () => {
          this.pending.requireFullSync()
          this.queueDelta()
        }
      })
      this.watchedPath = worktreePath
    } catch (error) {
      this.error = `Not watching file changes: ${messageOf(error)}`
    }
  }

  private async stopWatch(): Promise<void> {
    const watch = this.watch
    this.watch = null
    this.watchedPath = null
    await watch?.stop()
  }

  private onWatchEvents(events: WatchedEvents): void {
    this.pending.add(events)
    this.queueDelta()
  }

  private queueDelta(): void {
    this.queue.enqueueCoalesced('delta', () => this.runDelta())
  }

  private async runDelta(): Promise<void> {
    const pending = this.pending
    this.pending = new PendingDelta()
    const resolution = this.resolve()
    const worktreePath = this.worktreePath
    if (!resolution || !worktreePath || !this.worktreeId) {
      return
    }
    const target = this.target(resolution, worktreePath)
    let result: SyncResult
    if (pending.full) {
      result = await fullSync(target)
    } else {
      const delta = await deltaSync(target, pending.paths())
      result = delta.needsFullSync ? mergeResults(delta, await fullSync(target)) : delta
    }
    if (this.server.isRunning && touchesDepsFiles(result, resolution.slot.depsFiles)) {
      await this.restartWithInstall(resolution.slot)
    }
    this.hooks.persist()
  }
}
