import type { Repo } from '../../../shared/repo-types'
import {
  validateLiveProjectConfig,
  type LiveConfigEntry,
  type LiveConfigSaveResult,
  type LiveProjectConfig
} from '../../../shared/cachalote/live/live-types'
import { liveSlotKey, type LiveConfigStore } from './live-config-store'
import { isLiveEligibleRepo, normalizeLiveConfig, slotNeedsRestart } from './live-project-model'
import type { LiveSlot } from './live-slot'

export type ConfigChangeContext = {
  repoById: (repoId: string) => Repo | null
  repos: () => Repo[]
  config: LiveConfigStore
  entryFor: (repo: Repo) => LiveConfigEntry | null
  slotFor: (repoId: string, slotId: string) => LiveSlot | undefined
  forgetSlot: (repoId: string, slotId: string) => void
  notify: () => void
}

function portsOfOtherProjects(context: ConfigChangeContext, repoId: string): Set<number> {
  const ports = new Set<number>()
  for (const other of context.repos()) {
    if (other.id !== repoId && isLiveEligibleRepo(other)) {
      for (const slot of context.entryFor(other)?.config.slots ?? []) {
        ports.add(slot.port)
      }
    }
  }
  return ports
}

/** A slot whose port, install or start changed, or that was removed, stops. */
async function reconcileAfterConfigChange(
  context: ConfigChangeContext,
  repoId: string,
  before: LiveProjectConfig | undefined,
  after: LiveProjectConfig | undefined
): Promise<void> {
  for (const old of before?.slots ?? []) {
    const next = after?.slots.find((candidate) => candidate.id === old.id)
    const runtime = context.slotFor(repoId, old.id)
    if (runtime && (!next || slotNeedsRestart(old, next))) {
      await runtime.requestStop()
      if (!next) {
        runtime.dispose()
        context.forgetSlot(repoId, old.id)
      }
    }
    if (!next) {
      context.config.deleteSlot(liveSlotKey(repoId, old.id))
    }
  }
  context.notify()
}

export async function saveLiveConfig(
  context: ConfigChangeContext,
  config: LiveProjectConfig
): Promise<LiveConfigSaveResult> {
  const repo = context.repoById(config.repoId)
  if (!repo || !isLiveEligibleRepo(repo)) {
    return { ok: false, errors: [{ slotIndex: -1, field: 'id', reason: 'invalid' }] }
  }
  const errors = validateLiveProjectConfig(config, portsOfOtherProjects(context, repo.id))
  if (errors.length > 0) {
    return { ok: false, errors }
  }
  const before = context.entryFor(repo)?.config
  const normalized = normalizeLiveConfig(config)
  context.config.setConfig(normalized)
  await reconcileAfterConfigChange(context, repo.id, before, normalized)
  return { ok: true }
}

export async function resetLiveConfig(context: ConfigChangeContext, repoId: string): Promise<void> {
  const repo = context.repoById(repoId)
  if (!repo) {
    return
  }
  const before = context.entryFor(repo)?.config
  context.config.deleteConfig(repoId)
  await reconcileAfterConfigChange(context, repoId, before, context.entryFor(repo)?.config)
}
