import { describe, expect, it } from 'vitest'
import {
  validateLiveProjectConfig,
  type LiveProjectConfig,
  type LiveSlotConfig
} from './live-types'

function slot(overrides: Partial<LiveSlotConfig> = {}): LiveSlotConfig {
  return {
    id: 'web',
    label: 'Web',
    port: 3000,
    install: 'pnpm install',
    start: 'pnpm dev',
    depsFiles: ['package.json'],
    envFiles: ['.env*'],
    ...overrides
  }
}

function config(...slots: LiveSlotConfig[]): LiveProjectConfig {
  return { repoId: 'repo', slots }
}

const none: ReadonlySet<number> = new Set()

describe('validateLiveProjectConfig', () => {
  it('accepts a well-formed slot', () => {
    expect(validateLiveProjectConfig(config(slot()), none)).toEqual([])
  })

  it('requires an id, label and start command', () => {
    const errors = validateLiveProjectConfig(
      config(slot({ id: ' ', label: '', start: '  ' })),
      none
    )
    expect(errors).toEqual([
      { slotIndex: 0, field: 'id', reason: 'required' },
      { slotIndex: 0, field: 'label', reason: 'required' },
      { slotIndex: 0, field: 'start', reason: 'required' }
    ])
  })

  it('rejects ids outside [a-z0-9-] and duplicates', () => {
    const errors = validateLiveProjectConfig(
      config(slot({ id: 'Web' }), slot({ id: 'api', port: 3001 }), slot({ id: 'api', port: 3002 })),
      none
    )
    expect(errors).toEqual([
      { slotIndex: 0, field: 'id', reason: 'invalid' },
      { slotIndex: 2, field: 'id', reason: 'duplicate' }
    ])
  })

  it('checks the port range, duplicates inside the project and ports of other projects', () => {
    expect(validateLiveProjectConfig(config(slot({ port: 80 })), none)).toEqual([
      { slotIndex: 0, field: 'port', reason: 'invalid' }
    ])
    expect(validateLiveProjectConfig(config(slot({ port: 3000.5 })), none)).toEqual([
      { slotIndex: 0, field: 'port', reason: 'invalid' }
    ])
    expect(
      validateLiveProjectConfig(config(slot(), slot({ id: 'api' })), none).map(
        (error) => error.reason
      )
    ).toEqual(['duplicate'])
    expect(validateLiveProjectConfig(config(slot()), new Set([3000]))).toEqual([
      { slotIndex: 0, field: 'port', reason: 'taken' }
    ])
  })

  it('keeps dependency and env paths inside the repo', () => {
    const errors = validateLiveProjectConfig(
      config(slot({ depsFiles: ['/etc/passwd'], envFiles: ['../secrets/.env'] })),
      none
    )
    expect(errors).toEqual([
      { slotIndex: 0, field: 'depsFiles', reason: 'invalid' },
      { slotIndex: 0, field: 'envFiles', reason: 'invalid' }
    ])
  })
})
