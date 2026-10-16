// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LiveSlotPhase } from '../../../../shared/cachalote/live/live-types'
import { createLiveApiFixture, liveSlotFixture } from './live-api-fixture'
import { LivePill } from './LivePill'
import { stopLiveStore } from './live-store'
import { callsTo } from './live-test-harness'

const WORKTREE = 'repo-1::/wt/a'
let fixture: ReturnType<typeof createLiveApiFixture>

function installApi(slots: ReturnType<typeof liveSlotFixture>[], supported = true): void {
  stopLiveStore()
  fixture = createLiveApiFixture({ snapshot: { supported, slots } })
  Object.defineProperty(window, 'api', {
    value: { cachaloteLive: fixture.api },
    configurable: true
  })
}

function mountPill(
  slots: ReturnType<typeof liveSlotFixture>[],
  pushRight = false
): ReturnType<typeof render> {
  installApi(slots)
  return render(<LivePill worktreeId={WORKTREE} pushRight={pushRight} />)
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  stopLiveStore()
})

afterEach(() => {
  cleanup()
  stopLiveStore()
  Reflect.deleteProperty(window, 'api')
  vi.restoreAllMocks()
})

describe('LivePill', () => {
  it.each<[LiveSlotPhase, string]>([
    ['live', 'text-status-success'],
    ['syncing', 'text-muted-foreground'],
    ['starting', 'text-muted-foreground'],
    ['crashed', 'text-destructive'],
    ['port-busy', 'text-destructive']
  ])('renders the %s phase with its tone', async (phase, toneClass) => {
    mountPill([liveSlotFixture({ worktreeId: WORKTREE, phase, port: 3000 })])
    await settle()
    const pill = screen.getByRole('button')
    expect(pill.textContent).toBe(':3000')
    expect(pill.dataset.livePhase).toBe(phase)
    expect(pill.className).toContain(toneClass)
  })

  it('shows a spinner while syncing or starting and a dot otherwise', async () => {
    mountPill([liveSlotFixture({ worktreeId: WORKTREE, phase: 'starting' })])
    await settle()
    expect(screen.getByRole('button').querySelector('.animate-spin')).not.toBeNull()
    cleanup()
    stopLiveStore()
    mountPill([liveSlotFixture({ worktreeId: WORKTREE, phase: 'live' })])
    await settle()
    expect(screen.getByRole('button').querySelector('.animate-spin')).toBeNull()
  })

  it('renders nothing when no slot serves the worktree', async () => {
    const { container } = mountPill([
      liveSlotFixture({ worktreeId: 'repo-1::/wt/other', phase: 'live' }),
      liveSlotFixture({ slotId: 'api', port: 8080 })
    ])
    await settle()
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing where the feature is unsupported', async () => {
    installApi([], false)
    const { container } = render(<LivePill worktreeId={WORKTREE} pushRight={false} />)
    await settle()
    expect(container.innerHTML).toBe('')
  })

  it('pushes itself right only when asked', async () => {
    mountPill([liveSlotFixture({ worktreeId: WORKTREE, phase: 'live' })], true)
    await settle()
    expect(screen.getByRole('button').className).toContain('ml-auto')
    cleanup()
    stopLiveStore()
    mountPill([liveSlotFixture({ worktreeId: WORKTREE, phase: 'live' })], false)
    await settle()
    expect(screen.getByRole('button').className).not.toContain('ml-auto')
  })

  it('does not let a click reach the row', async () => {
    installApi([liveSlotFixture({ worktreeId: WORKTREE, phase: 'live' })])
    const onRowClick = vi.fn()
    render(
      <div role="presentation" onClick={onRowClick}>
        <LivePill worktreeId={WORKTREE} pushRight={false} />
      </div>
    )
    await settle()
    fireEvent.click(screen.getByRole('button'))
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('opens a popover with the error and the stop and logs actions', async () => {
    mountPill([
      liveSlotFixture({
        worktreeId: WORKTREE,
        phase: 'crashed',
        label: 'Web',
        error: 'exit 1',
        port: 3000
      })
    ])
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /3000/ }))
    expect(await screen.findByText(/exit 1/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /logs|Ver logs/i }))
    fireEvent.click(screen.getByRole('button', { name: /^(Detener|Stop)$/ }))
    await settle()
    const ref = { repoId: 'repo-1', slotId: 'web' }
    expect(callsTo(fixture.calls, 'focusTerminal')).toEqual([ref])
    expect(callsTo(fixture.calls, 'stop')).toEqual([ref])
  })
})
