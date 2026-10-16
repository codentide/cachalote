import type { PortOwner } from './live-port-owner'

/** The slice of the runtime a slot server drives; OrcaRuntimeService satisfies it. */
export type LiveRuntime = {
  createTerminal: (
    worktreeSelector: string,
    options: { cwd: string; command: string; title: string; presentation: 'background' }
  ) => Promise<{ handle: string; worktreeId: string; tabId?: string; ptyId?: string | null }>
  listTerminals: (
    worktreeSelector: string,
    limit?: number
  ) => Promise<{
    terminals: {
      handle: string
      ptyId: string | null
      tabId: string
      worktreeId: string
      title: string | null
    }[]
  }>
  closeTerminal: (handle: string) => Promise<unknown>
  focusTerminal: (handle: string) => Promise<unknown>
}

export type ServerPhase = 'idle' | 'starting' | 'live' | 'crashed' | 'port-busy'
export type ServerTerminal = { worktreeId: string; tabId: string; ptyId: string | null }
export type ServerState = {
  phase: ServerPhase
  startedAt: number | null
  error: string | null
  terminal: ServerTerminal | null
  portOwner: PortOwner | null
}

export type LiveServerDeps = {
  runtime: LiveRuntime
  /** True when something accepts connections on the port. */
  probe: (port: number) => Promise<boolean>
  resolveOwner: (port: number) => Promise<PortOwner | null>
  terminate: (pid: number) => void
  now: () => number
  sleep: (ms: number) => Promise<void>
}

export type LiveServerTarget = {
  port: number
  runnerPath: string
  /** Selector of the repo's main worktree, where the server's terminal lives. */
  terminalSelector: string
}

export const STARTUP_PROBE_INTERVAL_MS = 1_000
export const STARTUP_DEADLINE_MS = 10 * 60_000
export const STEADY_PROBE_INTERVAL_MS = 30_000
export const FAILURES_BEFORE_CRASH = 2
export const TERMINAL_LIST_LIMIT = 500
export const CLOSE_POLL_MS = 250
export const CLOSE_WAIT_MS = 3_000
export const KILL_WAIT_MS = 2_000

export function liveTerminalTitle(port: number): string {
  return `Sonar :${port}`
}

/** Install and start share one terminal; HUSKY=0 keeps git hooks from installing in a non-git runner. */
export function buildServerCommand(install: string, start: string): string {
  const installCommand = install.trim()
  return installCommand ? `HUSKY=0 ${installCommand} && ${start.trim()}` : start.trim()
}
