// Sonar: a project's fixed-port slots, each serving one worktree at a time from its own runner.

export type LiveSlotConfig = {
  /** Stable key, [a-z0-9-]+. */
  id: string
  /** Shown in menus: 'API', 'co'. */
  label: string
  /** 1024–65535, unique inside the project; another project may share it, one serving at a time. */
  port: number
  /** Shell command run in the runner before start; '' = none. */
  install: string
  /** Shell command that starts the dev server in the runner. */
  start: string
  /** Repo-relative paths; a change reinstalls and restarts the server. */
  depsFiles: string[]
  /** Repo-relative globs symlinked from the primary checkout when git ignores them. */
  envFiles: string[]
}

export type LiveProjectConfig = { repoId: string; slots: LiveSlotConfig[] }

/** A project's config and where it came from; 'seed' means nothing saved yet. */
export type LiveConfigEntry = { config: LiveProjectConfig; source: 'saved' | 'seed' }

// Install runs in the same terminal as start, so 'starting' covers both.
export type LiveSlotPhase = 'idle' | 'syncing' | 'starting' | 'live' | 'crashed' | 'port-busy'

export type LiveSlotState = {
  repoId: string
  slotId: string
  label: string
  port: number
  /** The worktree this slot serves; null when idle. */
  worktreeId: string | null
  runnerPath: string
  phase: LiveSlotPhase
  /** Epoch ms the current server process started. */
  startedAt: number | null
  /** Last failure, one line. */
  error: string | null
  /** The server's terminal. Handles are minted per process, so this names the pane, never a handle. */
  terminal: { worktreeId: string; tabId: string; ptyId: string | null } | null
  /** port-busy only: who holds the port. */
  portOwner: { pid: number; command: string; cwd: string | null } | null
}

/** Every configured slot of every local repo, idle ones included. */
export type LiveSnapshot = {
  /** False where the feature is off (only macOS for now); slots is then empty. */
  supported: boolean
  slots: LiveSlotState[]
}

export type LiveConfigError = {
  /** -1 for errors about the project as a whole. */
  slotIndex: number
  field: 'id' | 'label' | 'port' | 'start' | 'depsFiles' | 'envFiles'
  reason: 'required' | 'invalid' | 'duplicate'
}

export type LiveConfigSaveResult = { ok: true } | { ok: false; errors: LiveConfigError[] }

const SLOT_ID = /^[a-z0-9][a-z0-9-]*$/
const MIN_PORT = 1024
const MAX_PORT = 65535

/** Repo-relative and inside the repo: no absolute paths, no `..` segments. */
function isRepoRelative(path: string): boolean {
  const trimmed = path.trim()
  return (
    trimmed.length > 0 &&
    !trimmed.startsWith('/') &&
    !/^[a-z]:/i.test(trimmed) &&
    !trimmed.split(/[\\/]/).includes('..')
  )
}

/** Checks a project's slots. Another project may use the same port: only one of them serves at a time. */
export function validateLiveProjectConfig(config: LiveProjectConfig): LiveConfigError[] {
  const errors: LiveConfigError[] = []
  const ids = new Set<string>()
  const ports = new Set<number>()
  config.slots.forEach((slot, slotIndex) => {
    const id = slot.id.trim()
    if (!id) {
      errors.push({ slotIndex, field: 'id', reason: 'required' })
    } else if (!SLOT_ID.test(id)) {
      errors.push({ slotIndex, field: 'id', reason: 'invalid' })
    } else if (ids.has(id)) {
      errors.push({ slotIndex, field: 'id', reason: 'duplicate' })
    }
    ids.add(id)
    if (!slot.label.trim()) {
      errors.push({ slotIndex, field: 'label', reason: 'required' })
    }
    if (!Number.isInteger(slot.port) || slot.port < MIN_PORT || slot.port > MAX_PORT) {
      errors.push({ slotIndex, field: 'port', reason: 'invalid' })
    } else if (ports.has(slot.port)) {
      errors.push({ slotIndex, field: 'port', reason: 'duplicate' })
    }
    ports.add(slot.port)
    if (!slot.start.trim()) {
      errors.push({ slotIndex, field: 'start', reason: 'required' })
    }
    if (!slot.depsFiles.every(isRepoRelative)) {
      errors.push({ slotIndex, field: 'depsFiles', reason: 'invalid' })
    }
    if (!slot.envFiles.every(isRepoRelative)) {
      errors.push({ slotIndex, field: 'envFiles', reason: 'invalid' })
    }
  })
  return errors
}
