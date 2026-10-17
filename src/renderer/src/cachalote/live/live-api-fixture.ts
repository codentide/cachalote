import type { CachaloteLiveApi } from '../../../../shared/cachalote/live/live-ipc'
import type {
  LiveConfigEntry,
  LiveSlotState,
  LiveSnapshot
} from '../../../../shared/cachalote/live/live-types'

export type LiveApiCall = { method: keyof CachaloteLiveApi; args: unknown }

/** One slot state with test defaults; override what the test is about. */
export function liveSlotFixture(overrides: Partial<LiveSlotState> = {}): LiveSlotState {
  return {
    repoId: 'repo-1',
    slotId: 'web',
    label: 'Web',
    port: 3000,
    worktreeId: null,
    runnerPath: '/tmp/orca/live/repo/web',
    phase: 'idle',
    startedAt: null,
    error: null,
    terminal: null,
    portOwner: null,
    ...overrides
  }
}

/** In-memory CachaloteLiveApi for renderer tests: records calls and lets the test push snapshots. */
export function createLiveApiFixture(
  initial: { snapshot?: LiveSnapshot; configs?: Record<string, LiveConfigEntry> } = {}
): {
  api: CachaloteLiveApi
  calls: LiveApiCall[]
  emit: (snapshot: LiveSnapshot) => void
} {
  let snapshot: LiveSnapshot = initial.snapshot ?? { supported: true, slots: [] }
  const configs = { ...initial.configs }
  const calls: LiveApiCall[] = []
  const listeners = new Set<(next: LiveSnapshot) => void>()
  const record = (method: keyof CachaloteLiveApi, args: unknown): void => {
    calls.push({ method, args })
  }

  const api: CachaloteLiveApi = {
    getConfig: async (repoId) => {
      record('getConfig', repoId)
      return configs[repoId] ?? null
    },
    saveConfig: async (config) => {
      record('saveConfig', config)
      configs[config.repoId] = { config, source: 'saved' }
      return { ok: true }
    },
    resetConfig: async (repoId) => {
      record('resetConfig', repoId)
      delete configs[repoId]
    },
    project: async (args) => record('project', args),
    stop: async (args) => record('stop', args),
    snapshot: async () => {
      record('snapshot', undefined)
      return snapshot
    },
    usage: async (args) => {
      record('usage', args)
      return { rssBytes: 512 * 1024 * 1024 }
    },
    focusTerminal: async (args) => record('focusTerminal', args),
    freePort: async (args) => record('freePort', args),
    dismissStandby: async (args) => record('dismissStandby', args),
    logs: async (args) => {
      record('logs', args)
      return { lines: [], truncated: false, phase: 'idle' }
    },
    onChanged: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }

  const emit = (next: LiveSnapshot): void => {
    snapshot = next
    for (const listener of listeners) {
      listener(next)
    }
  }

  return { api, calls, emit }
}
