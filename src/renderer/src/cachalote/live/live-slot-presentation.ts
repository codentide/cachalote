import type { LiveSlotPhase } from '../../../../shared/cachalote/live/live-types'
import { liveLabel, type LiveLabelKey } from './live-labels'

export type LiveTone = 'success' | 'pending' | 'danger' | 'idle'

const PHASE_TONE: Record<LiveSlotPhase, LiveTone> = {
  idle: 'idle',
  syncing: 'pending',
  starting: 'pending',
  live: 'success',
  crashed: 'danger',
  'port-busy': 'danger'
}

const PHASE_LABEL: Record<LiveSlotPhase, LiveLabelKey> = {
  idle: 'phaseIdle',
  syncing: 'phaseSyncing',
  starting: 'phaseStarting',
  live: 'phaseLive',
  crashed: 'phaseCrashed',
  'port-busy': 'phasePortBusy'
}

export function liveTone(phase: LiveSlotPhase): LiveTone {
  return PHASE_TONE[phase]
}

export function livePhaseLabel(phase: LiveSlotPhase): string {
  return liveLabel(PHASE_LABEL[phase])
}

/** Text colour class per tone; literals so the design-system lint can see them. */
export const LIVE_TONE_TEXT: Record<LiveTone, string> = {
  success: 'text-status-success',
  pending: 'text-muted-foreground',
  danger: 'text-destructive',
  idle: 'text-muted-foreground'
}

/** "5m", "2h 10m", "3d 4h": the two largest units, no seconds past the first minute. */
export function formatUptime(startedAt: number, now: number): string {
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ${minutes % 60}m`
  }
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}
