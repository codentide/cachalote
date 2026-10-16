// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { liveSlotFixture } from './live-api-fixture'
import { liveLabel } from './live-labels'
import { callsTo, installLiveApi, removeLiveApi } from './live-test-harness'
import { LiveStatusSegment } from './LiveStatusSegment'

const WORKTREE = 'repo-1::/wt/a'

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function mount(
  slots: ReturnType<typeof liveSlotFixture>[],
  options: { supported?: boolean; iconOnly?: boolean } = {}
): ReturnType<typeof installLiveApi> {
  const fixture = installLiveApi({ snapshot: { supported: options.supported ?? true, slots } })
  render(
    <TooltipProvider>
      <LiveStatusSegment iconOnly={options.iconOnly ?? false} />
    </TooltipProvider>
  )
  return fixture
}

afterEach(() => {
  cleanup()
  removeLiveApi()
})

describe('LiveStatusSegment', () => {
  it('renders nothing when unsupported or without slots', async () => {
    mount([liveSlotFixture()], { supported: false })
    await settle()
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()
    mount([])
    await settle()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('counts the slots serving a worktree', async () => {
    mount([
      liveSlotFixture({ slotId: 'a', port: 3000, worktreeId: WORKTREE, phase: 'live' }),
      liveSlotFixture({ slotId: 'b', port: 3001 })
    ])
    await settle()
    expect(screen.getByRole('button').textContent).toBe(liveLabel('segmentLabel', { count: 1 }))
  })

  it('shows only the count when icon-only', async () => {
    mount([liveSlotFixture({ worktreeId: WORKTREE, phase: 'live' })], { iconOnly: true })
    await settle()
    expect(screen.getByRole('button').textContent).toBe('1')
  })

  it('lists every slot, idle included, and reads RAM once on open', async () => {
    useAppStore.setState({
      repos: [],
      worktreesByRepo: {}
    })
    const fixture = mount([
      liveSlotFixture({
        slotId: 'a',
        port: 3000,
        worktreeId: WORKTREE,
        phase: 'live',
        startedAt: 1
      }),
      liveSlotFixture({ slotId: 'b', port: 3001 })
    ])
    await settle()
    expect(callsTo(fixture.calls, 'usage')).toEqual([])
    fireEvent.click(screen.getByRole('button'))
    await settle()
    expect(screen.getByText(':3000')).toBeTruthy()
    expect(screen.getByText(':3001')).toBeTruthy()
    expect(callsTo(fixture.calls, 'usage')).toEqual([{ repoId: 'repo-1', slotId: 'a' }])
    expect(screen.getByText(/512 MB/)).toBeTruthy()
  })

  it('confirms before freeing a busy port and sends the pid it showed', async () => {
    const fixture = mount([
      liveSlotFixture({
        port: 3000,
        phase: 'port-busy',
        portOwner: { pid: 4242, command: 'node', cwd: '/somewhere' }
      })
    ])
    await settle()
    fireEvent.click(screen.getByRole('button'))
    await settle()
    expect(screen.getByText(/pid 4242/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: liveLabel('freePort') }))
    expect(callsTo(fixture.calls, 'freePort')).toEqual([])
    const dialog = await screen.findByRole('dialog')
    const confirm = Array.from(dialog.querySelectorAll('button')).find(
      (button) => button.textContent === liveLabel('freePort')
    )
    expect(confirm).toBeTruthy()
    if (confirm) {
      fireEvent.click(confirm)
    }
    await settle()
    expect(callsTo(fixture.calls, 'freePort')).toEqual([{ port: 3000, pid: 4242 }])
  })
})
