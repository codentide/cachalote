// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { LiveConfigEntry } from '../../../../shared/cachalote/live/live-types'
import { liveSlotFixture } from './live-api-fixture'
import { liveLabel } from './live-labels'
import { callsTo, installLiveApi, removeLiveApi } from './live-test-harness'
import { LiveSettingsSection } from './LiveSettingsSection'

function repoFixture(overrides: Partial<Repo> = {}): Repo {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the section reads only id, kind and connectionId.
  return { id: 'repo-1', displayName: 'ax-admin', ...overrides } as Repo
}

const seedEntry: LiveConfigEntry = {
  source: 'seed',
  config: {
    repoId: 'repo-1',
    slots: [
      {
        id: 'web',
        label: 'Web',
        port: 3000,
        install: 'pnpm install',
        start: 'pnpm dev',
        depsFiles: ['package.json'],
        envFiles: ['.env*']
      }
    ]
  }
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function mount(
  entry: LiveConfigEntry | undefined,
  repo = repoFixture(),
  supported = true
): ReturnType<typeof installLiveApi> {
  const fixture = installLiveApi({
    snapshot: { supported, slots: supported ? [liveSlotFixture()] : [] },
    configs: entry ? { 'repo-1': entry } : {}
  })
  render(<LiveSettingsSection repo={repo} />)
  return fixture
}

afterEach(() => {
  cleanup()
  removeLiveApi()
})

describe('LiveSettingsSection', () => {
  it.each([
    ['a folder repo', repoFixture({ kind: 'folder' }), true],
    ['an SSH repo', repoFixture({ connectionId: 'ssh-1' }), true],
    ['an unsupported platform', repoFixture(), false]
  ])('is hidden for %s', async (_name, repo, supported) => {
    installLiveApi({ snapshot: { supported, slots: [] }, configs: { 'repo-1': seedEntry } })
    const view = render(<LiveSettingsSection repo={repo} />)
    await settle()
    expect(view.container.innerHTML).toBe('')
  })

  it('loads the config of the repo into editable rows', async () => {
    const fixture = mount(seedEntry)
    await settle()
    expect(callsTo(fixture.calls, 'getConfig')).toEqual(['repo-1'])
    const port = screen.getByLabelText(liveLabel('slotPort'))
    expect(port).toHaveProperty('value', '3000')
    expect(screen.getByLabelText(liveLabel('slotStart'))).toHaveProperty('value', 'pnpm dev')
    expect(screen.getByLabelText(liveLabel('slotDepsFiles'))).toHaveProperty(
      'value',
      'package.json'
    )
  })

  it('keeps Save off until something changes and offers no reset for a seed', async () => {
    mount(seedEntry)
    await settle()
    const save = screen.getByRole('button', { name: liveLabel('save') })
    expect(save).toHaveProperty('disabled', true)
    expect(screen.queryByRole('button', { name: liveLabel('reset') })).toBeNull()
  })

  it('shows inline validation errors and blocks Save', async () => {
    const fixture = mount(seedEntry)
    await settle()
    fireEvent.change(screen.getByLabelText(liveLabel('slotPort')), { target: { value: '80' } })
    expect(screen.getByText(liveLabel('port-invalid'))).toBeTruthy()
    expect(screen.getByRole('button', { name: liveLabel('save') })).toHaveProperty('disabled', true)
    expect(callsTo(fixture.calls, 'saveConfig')).toEqual([])
  })

  it('saves the edited config with parsed lists and then offers Reset', async () => {
    const fixture = mount(seedEntry)
    await settle()
    fireEvent.change(screen.getByLabelText(liveLabel('slotPort')), { target: { value: '3100' } })
    fireEvent.change(screen.getByLabelText(liveLabel('slotDepsFiles')), {
      target: { value: 'package.json, pnpm-lock.yaml' }
    })
    fireEvent.click(screen.getByRole('button', { name: liveLabel('save') }))
    await settle()

    expect(callsTo(fixture.calls, 'saveConfig')).toEqual([
      {
        repoId: 'repo-1',
        slots: [
          {
            ...seedEntry.config.slots[0],
            port: 3100,
            depsFiles: ['package.json', 'pnpm-lock.yaml']
          }
        ]
      }
    ])
    expect(screen.getByRole('button', { name: liveLabel('reset') })).toBeTruthy()
  })

  it('shows the errors main returns when saving', async () => {
    const fixture = mount(seedEntry)
    await settle()
    // The fixture accepts everything, so make main refuse the port.
    fixture.api.saveConfig = async () => ({
      ok: false,
      errors: [{ slotIndex: 0, field: 'port', reason: 'duplicate' }]
    })
    fireEvent.change(screen.getByLabelText(liveLabel('slotPort')), { target: { value: '3100' } })
    fireEvent.click(screen.getByRole('button', { name: liveLabel('save') }))
    await settle()
    expect(screen.getByText(liveLabel('port-duplicate'))).toBeTruthy()
  })

  it('resets a saved config to its seed', async () => {
    const saved: LiveConfigEntry = {
      source: 'saved',
      config: {
        repoId: 'repo-1',
        slots: seedEntry.config.slots.map((slot) => ({ ...slot, port: 3200 }))
      }
    }
    const fixture = mount(saved)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: liveLabel('reset') }))
    await settle()
    expect(callsTo(fixture.calls, 'resetConfig')).toEqual(['repo-1'])
    expect(screen.queryByRole('button', { name: liveLabel('reset') })).toBeNull()
  })

  it('adds and removes slot rows', async () => {
    mount(seedEntry)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: liveLabel('addSlot') }))
    expect(screen.getAllByLabelText(liveLabel('slotPort'))).toHaveLength(2)
    const [firstRemove] = screen.getAllByRole('button', { name: liveLabel('removeSlot') })
    if (firstRemove) {
      fireEvent.click(firstRemove)
    }
    expect(screen.getAllByLabelText(liveLabel('slotPort'))).toHaveLength(1)
  })
})
