import { useEffect } from 'react'
import { create } from 'zustand'
import { toast } from 'sonner'
import type { CachaloteLiveApi, LiveSlotRef } from '../../../../shared/cachalote/live/live-ipc'
import type { LiveSlotState, LiveSnapshot } from '../../../../shared/cachalote/live/live-types'
import type { SonarLogsResult } from '../../../../shared/rpc-contract/cachalote-sonar-params'
import { liveLabel } from './live-labels'

const EMPTY_SLOTS: readonly LiveSlotState[] = []

type LiveState = {
  /** False until the first snapshot arrives and wherever the feature is off. */
  supported: boolean
  slots: readonly LiveSlotState[]
  byWorktree: Readonly<Record<string, readonly LiveSlotState[]>>
  byRepo: Readonly<Record<string, readonly LiveSlotState[]>>
  standbyByRepo: Readonly<Record<string, readonly string[]>>
}

const EMPTY_STANDBY: Readonly<Record<string, readonly string[]>> = {}

function groupSlots(
  slots: readonly LiveSlotState[],
  keyOf: (slot: LiveSlotState) => string | null
): Record<string, LiveSlotState[]> {
  const grouped: Record<string, LiveSlotState[]> = {}
  for (const slot of slots) {
    const key = keyOf(slot)
    if (key !== null) {
      ;(grouped[key] ??= []).push(slot)
    }
  }
  return grouped
}

function stateFromSnapshot(snapshot: LiveSnapshot): LiveState {
  const slots = snapshot.supported ? snapshot.slots : EMPTY_SLOTS
  return {
    supported: snapshot.supported,
    slots,
    byWorktree: groupSlots(slots, (slot) => slot.worktreeId),
    byRepo: groupSlots(slots, (slot) => slot.repoId),
    standbyByRepo: (snapshot.supported && snapshot.standbyByRepo) || EMPTY_STANDBY
  }
}

export const useLiveStore = create<LiveState>()(() =>
  stateFromSnapshot({ supported: false, slots: [] })
)

let stopListening: (() => void) | null = null

export function liveApi(): CachaloteLiveApi | undefined {
  return window.api?.cachaloteLive
}

/** Loads the snapshot and follows `onChanged`; calling it again is a no-op. */
export function startLiveStore(): void {
  const api = liveApi()
  if (!api || stopListening) {
    return
  }
  // Subscribe first so a change during the first snapshot is not lost; a later push wins over it.
  let pushed = false
  const unsubscribe = api.onChanged((snapshot) => {
    pushed = true
    useLiveStore.setState(stateFromSnapshot(snapshot))
  })
  stopListening = unsubscribe
  void api
    .snapshot()
    .then((snapshot) => {
      if (!pushed) {
        useLiveStore.setState(stateFromSnapshot(snapshot))
      }
    })
    .catch(() => {
      // The feature stays hidden; the next push still lands.
    })
}

/** Drops the subscription and state; tests and hot reload only. */
export function stopLiveStore(): void {
  stopListening?.()
  stopListening = null
  useLiveStore.setState(stateFromSnapshot({ supported: false, slots: [] }))
}

/** Components that read live state call this once so the first one to mount starts the store. */
export function useLiveStoreStarted(): void {
  useEffect(() => {
    startLiveStore()
  }, [])
}

export function useWorktreeLiveSlots(worktreeId: string): readonly LiveSlotState[] {
  useLiveStoreStarted()
  return useLiveStore((s) => s.byWorktree[worktreeId] ?? EMPTY_SLOTS)
}

async function run(action: (api: CachaloteLiveApi) => Promise<void>): Promise<void> {
  const api = liveApi()
  if (!api) {
    return
  }
  try {
    await action(api)
  } catch (error) {
    toast.error(liveLabel('actionFailed'), {
      description: error instanceof Error ? error.message : String(error)
    })
  }
}

export const liveActions = {
  project: (args: LiveSlotRef & { worktreeId: string }) => run((api) => api.project(args)),
  stop: (args: LiveSlotRef) => run((api) => api.stop(args)),
  focusTerminal: (args: LiveSlotRef) => run((api) => api.focusTerminal(args)),
  freePort: (args: { port: number; pid: number }) => run((api) => api.freePort(args)),
  dismissStandby: (args: { repoId: string; worktreeId: string }) =>
    run((api) => api.dismissStandby(args)),
  /** RAM on demand; null when nothing listens or the call fails. */
  async usage(args: LiveSlotRef): Promise<number | null> {
    try {
      return (await liveApi()?.usage(args))?.rssBytes ?? null
    } catch {
      return null
    }
  },
  /** Server output for the panel; null when the call fails, so a poll just keeps the last lines. */
  async logs(args: LiveSlotRef & { limit?: number }): Promise<SonarLogsResult | null> {
    try {
      return (await liveApi()?.logs(args)) ?? null
    } catch {
      return null
    }
  }
}
