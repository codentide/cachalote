import type { RecoverableSlot } from './live-engine'
import type { LiveRuntime } from './live-server-contract'

export const RECOVERY_RETRY_MS = 2_000
export const RECOVERY_GIVE_UP_MS = 2 * 60_000

/** registerCoreHandlers runs before terminals exist, so poll until the runtime answers. */
export async function waitForTerminalRuntime(
  runtime: Pick<LiveRuntime, 'listTerminals'>,
  selector: string,
  sleep: (ms: number) => Promise<void>
): Promise<boolean> {
  for (let waited = 0; waited <= RECOVERY_GIVE_UP_MS; waited += RECOVERY_RETRY_MS) {
    try {
      await runtime.listTerminals(selector, 1)
      return true
    } catch {
      await sleep(RECOVERY_RETRY_MS)
    }
  }
  return false
}

/** Re-attaches every slot that was serving before the restart; runs even if the runtime never answers. */
export async function recoverLiveSlots(
  slots: readonly RecoverableSlot[],
  runtime: Pick<LiveRuntime, 'listTerminals'>,
  sleep: (ms: number) => Promise<void>
): Promise<void> {
  const [first] = slots
  if (!first) {
    return
  }
  await waitForTerminalRuntime(runtime, first.terminalSelector, sleep)
  await Promise.all(
    slots.map((entry) =>
      entry.slot
        .requestRecovery(entry.worktreePath, entry.terminal, entry.startedAt)
        .catch((error: unknown) => {
          console.warn('[cachalote-live] recovery failed', error)
        })
    )
  )
}
