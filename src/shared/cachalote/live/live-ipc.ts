import type { SonarLogsResult } from '../../rpc-contract/cachalote-sonar-params'
import type {
  LiveConfigEntry,
  LiveConfigSaveResult,
  LiveProjectConfig,
  LiveSnapshot
} from './live-types'

export const CACHALOTE_LIVE_CHANNELS = {
  getConfig: 'cachalote-live:get-config',
  saveConfig: 'cachalote-live:save-config',
  resetConfig: 'cachalote-live:reset-config',
  project: 'cachalote-live:project',
  stop: 'cachalote-live:stop',
  snapshot: 'cachalote-live:snapshot',
  usage: 'cachalote-live:usage',
  focusTerminal: 'cachalote-live:focus-terminal',
  freePort: 'cachalote-live:free-port',
  logs: 'cachalote-live:logs',
  dismissStandby: 'cachalote-live:dismiss-standby',
  /** Main → renderer push; the payload is the whole LiveSnapshot. */
  changed: 'cachalote-live:changed'
} as const

export type LiveSlotRef = { repoId: string; slotId: string }

/** `window.api.cachaloteLive`. `snapshot()` is authoritative after a renderer reload. */
export type CachaloteLiveApi = {
  /** Saved config, else the seed by sidebar name, else null. */
  getConfig: (repoId: string) => Promise<LiveConfigEntry | null>
  /** Main validates again (ports taken by other projects); a saved change stops that slot if it is live. */
  saveConfig: (config: LiveProjectConfig) => Promise<LiveConfigSaveResult>
  /** Drops the saved config so the project goes back to its seed. */
  resetConfig: (repoId: string) => Promise<void>
  /** Serves the worktree on the slot; resolves once the request is queued, progress comes via onChanged. */
  project: (args: LiveSlotRef & { worktreeId: string }) => Promise<void>
  stop: (args: LiveSlotRef) => Promise<void>
  snapshot: () => Promise<LiveSnapshot>
  /** RSS of the process tree listening on the slot's port; null when nothing listens. */
  usage: (args: LiveSlotRef) => Promise<{ rssBytes: number | null }>
  /** Shows the slot's server terminal ("ver logs"). */
  focusTerminal: (args: LiveSlotRef) => Promise<void>
  /** Kills a foreign listener only if `pid` still holds `port` with the cwd and command the UI showed. */
  freePort: (args: { port: number; pid: number }) => Promise<void>
  /** The server terminal's last `limit` lines (main clamps it; default 80). */
  logs: (args: LiveSlotRef & { limit?: number }) => Promise<SonarLogsResult>
  /** Takes a worktree off its project's standby list; one being served stays served. */
  dismissStandby: (args: { repoId: string; worktreeId: string }) => Promise<void>
  onChanged: (listener: (snapshot: LiveSnapshot) => void) => () => void
}
