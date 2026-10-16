import { describe, expect, it } from 'vitest'
import {
  configFingerprint,
  configFromDrafts,
  draftFromSlot,
  emptySlotDraft,
  errorsForSlot,
  splitList,
  validateDrafts
} from './live-settings-model'

const slot = {
  id: 'web',
  label: 'Web',
  port: 3000,
  install: 'pnpm install',
  start: 'pnpm dev',
  depsFiles: ['package.json', 'pnpm-lock.yaml'],
  envFiles: ['.env*']
}

describe('live settings model', () => {
  it('splits comma-separated lists and drops blanks', () => {
    expect(splitList(' a, b ,, c ')).toEqual(['a', 'b', 'c'])
    expect(splitList('')).toEqual([])
  })

  it('round-trips a slot through its draft', () => {
    const draft = draftFromSlot(slot, 'k')
    expect(configFromDrafts('repo-1', [draft])).toEqual({ repoId: 'repo-1', slots: [slot] })
  })

  it('gives equal fingerprints to equal configs and different ones after an edit', () => {
    const base = configFromDrafts('repo-1', [draftFromSlot(slot, 'k')])
    const same = configFromDrafts('repo-1', [draftFromSlot(slot, 'other-key')])
    const edited = configFromDrafts('repo-1', [{ ...draftFromSlot(slot, 'k'), port: '3001' }])
    expect(configFingerprint(same)).toBe(configFingerprint(base))
    expect(configFingerprint(edited)).not.toBe(configFingerprint(base))
  })

  it('reports what the shared validator finds, by slot and field', () => {
    const drafts = [
      draftFromSlot(slot, 'a'),
      { ...emptySlotDraft('b'), id: 'web', label: 'Again', port: '3000', start: 'x' },
      { ...emptySlotDraft('c'), port: 'abc' }
    ]
    const errors = validateDrafts('repo-1', drafts)
    expect(errorsForSlot(errors, 0)).toEqual({})
    expect(Object.keys(errorsForSlot(errors, 1)).sort()).toEqual(['id', 'port'])
    expect(Object.keys(errorsForSlot(errors, 2)).sort()).toEqual(['id', 'label', 'port', 'start'])
  })

  it('treats an empty port as invalid', () => {
    const errors = validateDrafts('repo-1', [{ ...draftFromSlot(slot, 'a'), port: '  ' }])
    expect(errors).toEqual([{ slotIndex: 0, field: 'port', reason: 'invalid' }])
  })
})
