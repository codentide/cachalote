import type {
  LiveConfigError,
  LiveProjectConfig,
  LiveSlotConfig
} from '../../../../shared/cachalote/live/live-types'
import { validateLiveProjectConfig } from '../../../../shared/cachalote/live/live-types'
import { isLiveLabelKey, liveLabel } from './live-labels'

/** A slot as the editor holds it: every field is text, lists are comma-separated. */
export type SlotDraft = {
  /** Stable React key; never sent to main. */
  key: string
  id: string
  label: string
  port: string
  install: string
  start: string
  depsFiles: string
  envFiles: string
}

export function splitList(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
}

export function draftFromSlot(slot: LiveSlotConfig, key: string): SlotDraft {
  return {
    key,
    id: slot.id,
    label: slot.label,
    port: String(slot.port),
    install: slot.install,
    start: slot.start,
    depsFiles: slot.depsFiles.join(', '),
    envFiles: slot.envFiles.join(', ')
  }
}

export function emptySlotDraft(key: string): SlotDraft {
  return {
    key,
    id: '',
    label: '',
    port: '',
    install: '',
    start: '',
    depsFiles: '',
    envFiles: ''
  }
}

function slotFromDraft(draft: SlotDraft): LiveSlotConfig {
  const port = draft.port.trim()
  return {
    id: draft.id.trim(),
    label: draft.label.trim(),
    // NaN fails the integer check in validateLiveProjectConfig, same as an empty field.
    port: port === '' ? Number.NaN : Number(port),
    install: draft.install.trim(),
    start: draft.start.trim(),
    depsFiles: splitList(draft.depsFiles),
    envFiles: splitList(draft.envFiles)
  }
}

export function configFromDrafts(repoId: string, drafts: readonly SlotDraft[]): LiveProjectConfig {
  return { repoId, slots: drafts.map(slotFromDraft) }
}

/** Comparable form of a config, to tell whether the editor has unsaved changes. */
export function configFingerprint(config: LiveProjectConfig): string {
  return JSON.stringify(config.slots.map((slot) => ({ ...slot, port: String(slot.port) })))
}

/** Errors the shared validator finds before main checks the same config again. */
export function validateDrafts(repoId: string, drafts: readonly SlotDraft[]): LiveConfigError[] {
  return validateLiveProjectConfig(configFromDrafts(repoId, drafts))
}

export function liveConfigErrorText(error: LiveConfigError): string {
  const key = `${error.field}-${error.reason}`
  return isLiveLabelKey(key) ? liveLabel(key) : liveLabel('config-invalid')
}

/** Error texts of one slot, by field. */
export function errorsForSlot(
  errors: readonly LiveConfigError[],
  slotIndex: number
): Partial<Record<LiveConfigError['field'], string>> {
  const byField: Partial<Record<LiveConfigError['field'], string>> = {}
  for (const error of errors) {
    if (error.slotIndex === slotIndex && byField[error.field] === undefined) {
      byField[error.field] = liveConfigErrorText(error)
    }
  }
  return byField
}
