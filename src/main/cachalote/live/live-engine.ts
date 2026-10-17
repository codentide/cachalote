import type { Repo } from '../../../shared/repo-types'
import { getRepoMainWorktreeId } from '../../../shared/worktree/id'
import type {
  LiveConfigEntry,
  LiveConfigSaveResult,
  LiveProjectConfig,
  LiveSlotConfig,
  LiveSlotState,
  LiveSnapshot
} from '../../../shared/cachalote/live/live-types'
import type { SonarLogsResult } from '../../../shared/rpc-contract/cachalote-sonar-params'
import type { LiveSlotRef } from '../../../shared/cachalote/live/live-ipc'
import {
  liveSlotKey,
  parseLiveSlotKey,
  type LiveConfigStore,
  type PersistedTerminal
} from './live-config-store'
import type { PortInspector, PortOwner } from './live-port-owner'
import { resetLiveConfig, saveLiveConfig, type ConfigChangeContext } from './live-config-changes'
import { freeForeignPort } from './live-port-release'
import {
  effectiveLiveConfig,
  isLiveEligibleRepo,
  liveRunnerPath,
  slotsHoldingPort,
  worktreePathForRepo
} from './live-project-model'
import { LiveSlot, type LiveSlotDeps, type SlotResolution } from './live-slot'
import { isWorktreeOfRepo } from './live-worktree-membership'

export type LiveEngineDeps = {
  getRepos: () => Repo[]
  config: LiveConfigStore
  slotDeps: LiveSlotDeps
  inspector: Pick<PortInspector, 'resolveOwner' | 'treeRssBytes'>
  platform: NodeJS.Platform
  homeDir: string
  emit: (snapshot: LiveSnapshot) => void
  belongsToRepo?: (repoPath: string, worktreePath: string) => Promise<boolean>
}

export type RecoverableSlot = {
  slot: LiveSlot
  worktreePath: string
  terminal: PersistedTerminal | null
  startedAt: number | null
  terminalSelector: string
}

const BROADCAST_INTERVAL_MS = 100

/** The registry of slots across projects, plus the config rules around them. */
export class LiveEngine {
  private readonly slots = new Map<string, LiveSlot>()
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly deps: LiveEngineDeps) {}

  private get supported(): boolean {
    return this.deps.platform === 'darwin'
  }

  private repoById(repoId: string): Repo | null {
    return this.deps.getRepos().find((repo) => repo.id === repoId) ?? null
  }

  private entryFor(repo: Repo): LiveConfigEntry | null {
    return effectiveLiveConfig(repo, this.deps.config.getConfig(repo.id))
  }

  private resolveSlot(repoId: string, slotId: string): SlotResolution | null {
    const repo = this.repoById(repoId)
    const slot =
      repo && isLiveEligibleRepo(repo)
        ? this.entryFor(repo)?.config.slots.find((candidate) => candidate.id === slotId)
        : undefined
    if (!repo || !slot) {
      return null
    }
    return {
      slot,
      repoPath: repo.path,
      runnerRoot: liveRunnerPath(this.deps.homeDir, repo, this.deps.getRepos(), slot.id),
      terminalSelector: `id:${getRepoMainWorktreeId(repo)}`
    }
  }

  notify(): void {
    if (this.broadcastTimer) {
      return
    }
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null
      this.deps.emit(this.snapshot())
    }, BROADCAST_INTERVAL_MS)
    this.broadcastTimer.unref?.()
  }

  private persist(key: string, slot: LiveSlot): void {
    const view = slot.view()
    this.deps.config.setSlot(key, {
      worktreeId: view.worktreeId,
      manifest: Object.fromEntries(slot.manifest),
      terminal: view.server.terminal,
      startedAt: view.server.startedAt
    })
  }

  /** The slot's runtime, created on first use from whatever the config store remembers of it. */
  ensureSlot(repoId: string, slotId: string, recovering = false): LiveSlot {
    const key = liveSlotKey(repoId, slotId)
    const existing = this.slots.get(key)
    if (existing) {
      return existing
    }
    const saved = this.deps.config.getSlot(key)
    const slot = new LiveSlot(
      { repoId, slotId },
      this.deps.slotDeps,
      () => this.resolveSlot(repoId, slotId),
      { changed: () => this.notify(), persist: () => this.persist(key, slot) },
      {
        worktreeId: saved?.worktreeId ?? null,
        manifest: new Map(Object.entries(saved?.manifest ?? {})),
        recovering
      }
    )
    this.slots.set(key, slot)
    return slot
  }

  snapshot(): LiveSnapshot {
    if (!this.supported) {
      return { supported: false, slots: [] }
    }
    const repos = this.deps.getRepos()
    const slots: LiveSlotState[] = []
    const eligible = repos.filter(isLiveEligibleRepo)
    const saved = this.deps.config.standbyEntries()
    const standbyByRepo: Record<string, readonly string[]> = {}
    for (const repo of eligible) {
      if (saved[repo.id]) {
        standbyByRepo[repo.id] = saved[repo.id]
      }
    }
    for (const repo of eligible) {
      for (const slot of this.entryFor(repo)?.config.slots ?? []) {
        slots.push(this.slotState(repo, repos, slot))
      }
    }
    return { supported: true, slots, standbyByRepo }
  }

  private slotState(repo: Repo, repos: Repo[], slot: LiveSlotConfig): LiveSlotState {
    const runtime = this.slots.get(liveSlotKey(repo.id, slot.id))
    const view = runtime?.view()
    return {
      repoId: repo.id,
      slotId: slot.id,
      label: slot.label,
      port: slot.port,
      worktreeId: view?.worktreeId ?? null,
      runnerPath: liveRunnerPath(this.deps.homeDir, repo, repos, slot.id),
      phase: view?.phase ?? 'idle',
      startedAt: view?.server.startedAt ?? null,
      error: view?.error ?? null,
      terminal: view?.server.terminal ?? null,
      portOwner: view?.server.portOwner ?? null
    }
  }

  /**
   * Slots that were serving before a restart, marked as recovering until `requestRecovery` runs.
   * Records whose project or slot no longer exists are dropped.
   */
  adoptPersistedSlots(): RecoverableSlot[] {
    if (!this.supported) {
      return []
    }
    const recoverable: RecoverableSlot[] = []
    for (const key of this.deps.config.slotKeys()) {
      const ref = parseLiveSlotKey(key)
      const saved = this.deps.config.getSlot(key)
      const resolution = ref ? this.resolveSlot(ref.repoId, ref.slotId) : null
      if (!ref || !saved || !resolution) {
        this.deps.config.deleteSlot(key)
        continue
      }
      const worktreePath = saved.worktreeId
        ? worktreePathForRepo(ref.repoId, saved.worktreeId)
        : null
      if (worktreePath) {
        const slot = this.ensureSlot(ref.repoId, ref.slotId, true)
        slot.server.seed(saved.terminal, saved.startedAt)
        recoverable.push({
          slot,
          worktreePath,
          terminal: saved.terminal,
          startedAt: saved.startedAt,
          terminalSelector: resolution.terminalSelector
        })
      }
    }
    return recoverable
  }

  getConfig(repoId: string): LiveConfigEntry | null {
    const repo = this.repoById(repoId)
    return repo ? this.entryFor(repo) : null
  }

  private get configContext(): ConfigChangeContext {
    return {
      repoById: (repoId) => this.repoById(repoId),
      config: this.deps.config,
      entryFor: (repo) => this.entryFor(repo),
      slotFor: (repoId, slotId) => this.slots.get(liveSlotKey(repoId, slotId)),
      forgetSlot: (repoId, slotId) => this.slots.delete(liveSlotKey(repoId, slotId)),
      notify: () => this.notify()
    }
  }

  saveConfig(config: LiveProjectConfig): Promise<LiveConfigSaveResult> {
    return saveLiveConfig(this.configContext, config)
  }

  resetConfig(repoId: string): Promise<void> {
    return resetLiveConfig(this.configContext, repoId)
  }

  async project(args: LiveSlotRef & { worktreeId: string }): Promise<void> {
    if (!this.supported) {
      throw new Error('Sonar is only available on macOS.')
    }
    const repo = this.repoById(args.repoId)
    if (!repo || !isLiveEligibleRepo(repo)) {
      throw new Error('This project cannot be served live.')
    }
    const resolution = this.resolveSlot(args.repoId, args.slotId)
    const worktreePath = worktreePathForRepo(args.repoId, args.worktreeId)
    if (!resolution || !worktreePath) {
      throw new Error('Unknown slot or worktree.')
    }
    const belongs = this.deps.belongsToRepo ?? isWorktreeOfRepo
    if (!(await belongs(repo.path, worktreePath))) {
      throw new Error('That worktree does not belong to this project.')
    }
    const holders = slotsHoldingPort(this.snapshot().slots, args, resolution.slot.port)
    await Promise.all(holders.map((other) => this.stop(other)))
    const slot = this.ensureSlot(args.repoId, args.slotId)
    this.deps.config.recordStandby(args.repoId, args.worktreeId)
    this.notify()
    void slot.requestProject(args.worktreeId, worktreePath).catch((error: unknown) => {
      console.warn('[cachalote-live] project failed', error)
    })
  }

  dismissStandby(args: { repoId: string; worktreeId: string }): void {
    this.deps.config.removeStandby(args.repoId, args.worktreeId)
    this.notify()
  }

  async stop(args: LiveSlotRef): Promise<void> {
    await this.slots.get(liveSlotKey(args.repoId, args.slotId))?.requestStop()
  }

  async usage(args: LiveSlotRef): Promise<{ rssBytes: number | null }> {
    const resolution = this.resolveSlot(args.repoId, args.slotId)
    if (!resolution) {
      return { rssBytes: null }
    }
    try {
      return {
        rssBytes: await this.deps.inspector.treeRssBytes(
          resolution.slot.port,
          resolution.runnerRoot
        )
      }
    } catch {
      return { rssBytes: null }
    }
  }

  async readLogs(ref: LiveSlotRef, limit: number): Promise<SonarLogsResult> {
    const slot = this.slots.get(liveSlotKey(ref.repoId, ref.slotId))
    return slot ? slot.readLogs(limit) : { lines: [], truncated: false, phase: 'idle' }
  }

  async focusTerminal(args: LiveSlotRef): Promise<void> {
    const slot = this.slots.get(liveSlotKey(args.repoId, args.slotId))
    if (!slot) {
      throw new Error('That slot is not serving anything.')
    }
    await slot.server.focusTerminal()
  }

  /** The slot reporting `pid` as the foreign holder of `port`, with what it recorded about it. */
  findPortBusySlot(port: number, pid: number): { slot: LiveSlot; owner: PortOwner } | null {
    for (const slot of this.slots.values()) {
      const { phase, portOwner } = slot.server.getState()
      if (
        phase === 'port-busy' &&
        portOwner?.pid === pid &&
        this.resolveSlot(slot.ref.repoId, slot.ref.slotId)?.slot.port === port
      ) {
        return { slot, owner: portOwner }
      }
    }
    return null
  }

  freePort(args: { port: number; pid: number }): Promise<void> {
    return freeForeignPort(args, {
      find: (port, pid) => this.findPortBusySlot(port, pid),
      resolveOwner: (port) => this.deps.inspector.resolveOwner(port),
      server: this.deps.slotDeps.server
    })
  }

  dispose(): void {
    if (this.broadcastTimer) {
      clearTimeout(this.broadcastTimer)
      this.broadcastTimer = null
    }
    for (const slot of this.slots.values()) {
      slot.dispose()
    }
  }
}
