import { isInsideDirectory } from './live-port-owner'
import {
  buildServerCommand,
  CLOSE_POLL_MS,
  CLOSE_WAIT_MS,
  FAILURES_BEFORE_CRASH,
  KILL_WAIT_MS,
  liveTerminalTitle,
  STARTUP_DEADLINE_MS,
  STARTUP_PROBE_INTERVAL_MS,
  STEADY_PROBE_INTERVAL_MS,
  TERMINAL_LIST_LIMIT,
  type LiveRuntime,
  type LiveServerDeps,
  type LiveServerTarget,
  type ServerState,
  type ServerTerminal
} from './live-server-contract'

export { buildServerCommand, liveTerminalTitle }

type ProbeMode = 'starting' | 'steady'
type LocatedTerminal = { handle: string; terminal: ServerTerminal }

function firstLine(message: string): string {
  return message.split('\n')[0]?.trim() || 'unknown error'
}

const IDLE_STATE: ServerState = {
  phase: 'idle',
  startedAt: null,
  error: null,
  terminal: null,
  portOwner: null
}

/** One slot's dev server: a terminal in the main worktree plus a port probe; never one per worktree. */
export class LiveSlotServer {
  private state: ServerState = { ...IDLE_STATE }
  private generation = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private failures = 0

  constructor(
    private readonly deps: LiveServerDeps,
    private readonly target: () => LiveServerTarget,
    private readonly onChange: () => void
  ) {}

  getState(): ServerState {
    return { ...this.state }
  }

  /** Remembers the persisted terminal so a stop before recovery still finds it. */
  seed(terminal: ServerTerminal | null, startedAt: number | null): void {
    this.state = { ...IDLE_STATE, terminal, startedAt }
  }

  /** Starting or live: a restart is only needed when it is neither. */
  get isRunning(): boolean {
    return this.state.phase === 'starting' || this.state.phase === 'live'
  }

  private update(patch: Partial<ServerState>): void {
    this.state = { ...this.state, ...patch }
    this.onChange()
  }

  private cancelTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  dispose(): void {
    this.generation += 1
    this.cancelTimer()
  }

  async start(command: string): Promise<void> {
    const { port, runnerPath, terminalSelector } = this.target()
    this.cancelTimer()
    const generation = ++this.generation
    this.failures = 0
    if (await this.deps.probe(port)) {
      const owner = await this.deps.resolveOwner(port).catch(() => null)
      if (generation !== this.generation) {
        return
      }
      if (owner && isInsideDirectory(runnerPath, owner.cwd)) {
        // Our own server from before Cachalote lost track of it: adopt instead of fighting it.
        const located = await this.locate()
        this.update({
          phase: 'live',
          startedAt: this.deps.now(),
          error: null,
          portOwner: null,
          terminal: located?.terminal ?? this.state.terminal
        })
        this.schedule('steady', generation)
        return
      }
      this.update({
        phase: 'port-busy',
        startedAt: null,
        terminal: null,
        portOwner: owner,
        error: `Port ${port} is held by ${owner?.command ?? 'another process'}`
      })
      return
    }
    try {
      const created = await this.deps.runtime.createTerminal(terminalSelector, {
        cwd: runnerPath,
        command,
        title: liveTerminalTitle(port),
        presentation: 'background'
      })
      if (generation !== this.generation) {
        return
      }
      this.update({
        phase: 'starting',
        startedAt: this.deps.now(),
        error: null,
        portOwner: null,
        terminal: {
          worktreeId: created.worktreeId,
          tabId: created.tabId ?? '',
          ptyId: created.ptyId ?? null
        }
      })
      this.schedule('starting', generation)
    } catch (error) {
      if (generation === this.generation) {
        this.update({
          phase: 'crashed',
          startedAt: null,
          terminal: null,
          error: firstLine(error instanceof Error ? error.message : String(error))
        })
      }
    }
  }

  /** Re-attaches after a Cachalote restart: finds the terminal and classifies the port. */
  async restore(terminal: ServerTerminal | null, startedAt: number | null): Promise<void> {
    const { port, runnerPath } = this.target()
    this.cancelTimer()
    const generation = ++this.generation
    this.failures = 0
    this.state = { ...IDLE_STATE, terminal, startedAt }
    const located = await this.locate()
    const open = await this.deps.probe(port)
    if (generation !== this.generation) {
      return
    }
    if (open) {
      const owner = located ? null : await this.deps.resolveOwner(port).catch(() => null)
      if (!located && owner && !isInsideDirectory(runnerPath, owner.cwd)) {
        this.update({
          phase: 'port-busy',
          startedAt: null,
          terminal: null,
          portOwner: owner,
          error: `Port ${port} is held by ${owner.command}`
        })
        return
      }
      this.update({ phase: 'live', error: null, terminal: located?.terminal ?? terminal })
      this.schedule('steady', generation)
    } else if (located) {
      this.update({
        phase: 'starting',
        startedAt: startedAt ?? this.deps.now(),
        error: null,
        terminal: located.terminal
      })
      this.schedule('starting', generation)
    } else {
      this.update({
        phase: 'crashed',
        startedAt: null,
        terminal: null,
        error: 'The server is not running'
      })
      this.schedule('steady', generation)
    }
  }

  async stop(): Promise<void> {
    const { port, runnerPath } = this.target()
    this.generation += 1
    this.cancelTimer()
    const ours = this.isRunning || this.state.phase === 'crashed' || this.state.terminal !== null
    if (ours) {
      const located = await this.locate()
      if (located) {
        await this.deps.runtime.closeTerminal(located.handle).catch(() => undefined)
      }
      if (await this.deps.probe(port)) {
        if (!(await this.waitForPortClosed(CLOSE_WAIT_MS))) {
          // Last resort, and only for a process that lives in this runner.
          const owner = await this.deps.resolveOwner(port).catch(() => null)
          if (owner && isInsideDirectory(runnerPath, owner.cwd)) {
            this.deps.terminate(owner.pid)
            await this.waitForPortClosed(KILL_WAIT_MS)
          }
        }
      }
    }
    this.state = { ...IDLE_STATE }
    this.onChange()
  }

  async focusTerminal(): Promise<void> {
    const located = await this.locate()
    if (!located) {
      throw new Error('The server terminal is no longer open.')
    }
    await this.deps.runtime.focusTerminal(located.handle)
  }

  /** The server terminal's recent output; null when its pane is gone. */
  async readLogs(limit: number): Promise<{ lines: string[]; truncated: boolean } | null> {
    const located = await this.locate()
    if (!located) {
      return null
    }
    const read = await this.deps.runtime.readTerminal(located.handle, { limit })
    return { lines: read.tail, truncated: read.truncated }
  }

  /** Back to idle after the port's foreign holder was stopped. */
  clearPortBusy(): void {
    if (this.state.phase === 'port-busy') {
      this.state = { ...IDLE_STATE }
      this.onChange()
    }
  }

  private async waitForPortClosed(timeoutMs: number): Promise<boolean> {
    const { port } = this.target()
    for (let waited = 0; waited < timeoutMs; waited += CLOSE_POLL_MS) {
      if (!(await this.deps.probe(port))) {
        return true
      }
      await this.deps.sleep(CLOSE_POLL_MS)
    }
    return !(await this.deps.probe(port))
  }

  /** The terminal's current listing; handles are minted per process, so it is looked up every time. */
  private async locate(): Promise<LocatedTerminal | null> {
    const { port, terminalSelector } = this.target()
    const known = this.state.terminal
    let listed: Awaited<ReturnType<LiveRuntime['listTerminals']>>['terminals']
    try {
      listed = (await this.deps.runtime.listTerminals(terminalSelector, TERMINAL_LIST_LIMIT))
        .terminals
    } catch {
      return null
    }
    const match =
      (known?.ptyId ? listed.find((terminal) => terminal.ptyId === known.ptyId) : undefined) ??
      listed.find((terminal) => terminal.title === liveTerminalTitle(port))
    if (!match) {
      return null
    }
    return {
      handle: match.handle,
      terminal: { worktreeId: match.worktreeId, tabId: match.tabId, ptyId: match.ptyId }
    }
  }

  private schedule(mode: ProbeMode, generation: number): void {
    this.cancelTimer()
    const delay = mode === 'starting' ? STARTUP_PROBE_INTERVAL_MS : STEADY_PROBE_INTERVAL_MS
    this.timer = setTimeout(() => void this.tick(mode, generation), delay)
    this.timer.unref?.()
  }

  private async tick(mode: ProbeMode, generation: number): Promise<void> {
    if (generation !== this.generation) {
      return
    }
    const { port } = this.target()
    const open = await this.deps.probe(port)
    if (generation !== this.generation) {
      return
    }
    if (open) {
      this.failures = 0
      if (this.state.phase !== 'live') {
        this.update({ phase: 'live', error: null })
      }
      this.schedule('steady', generation)
      return
    }
    if (mode === 'starting') {
      const startedAt = this.state.startedAt ?? this.deps.now()
      if (this.deps.now() - startedAt >= STARTUP_DEADLINE_MS) {
        this.update({ phase: 'crashed', error: `Port ${port} never opened` })
        this.schedule('steady', generation)
      } else {
        this.schedule('starting', generation)
      }
      return
    }
    // One missed probe can be a config reload; only a second in a row is a crash.
    this.failures += 1
    if (this.failures >= FAILURES_BEFORE_CRASH && this.state.phase !== 'crashed') {
      this.update({ phase: 'crashed', error: `Port ${port} stopped answering` })
    }
    this.schedule('steady', generation)
  }
}
