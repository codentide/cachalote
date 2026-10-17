import type { LiveEngine } from './live-engine'

/** What the `sonar.*` RPC methods use; narrow so their tests can pass a plain fake. */
export type SonarEngine = Pick<LiveEngine, 'snapshot' | 'project' | 'stop' | 'readLogs'>

// The RPC server serves before the first window registers Sonar, and headless `orca serve` never does.
let current: SonarEngine | null = null

export function setLiveEngine(engine: SonarEngine | null): void {
  current = engine
}

/** The process's Sonar engine; throws while there is none so RPC callers get a clear message. */
export function requireLiveEngine(): SonarEngine {
  if (!current) {
    throw new Error('Sonar is not available in this Orca runtime.')
  }
  return current
}
