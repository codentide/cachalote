// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { liveSlotFixture } from './live-api-fixture'
import { liveLabel } from './live-labels'
import { callsTo, installLiveApi, removeLiveApi } from './live-test-harness'
import { sonarRepo, sonarWorktree } from './sonar-panel-test-fixtures'
import SonarPanel from './SonarPanel'

const main = sonarWorktree('repo-1', 'main', { isMainWorktree: true })
const feature = sonarWorktree('repo-1', 'feature')
const spare = sonarWorktree('repo-1', 'spare')

async function settle(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

function seedApp(): void {
  useAppStore.setState({
    repos: [sonarRepo('repo-1', 'Alpha'), sonarRepo('repo-2', 'Beta')],
    worktreesByRepo: {
      'repo-1': [main, feature, spare],
      'repo-2': [sonarWorktree('repo-2', 'dev')]
    },
    activeWorktreeId: main.id
  })
}

function mount(
  slots: ReturnType<typeof liveSlotFixture>[],
  isVisible = true,
  standbyByRepo: Record<string, string[]> = { 'repo-1': [feature.id] }
): ReturnType<typeof installLiveApi> & { rerenderVisible: (visible: boolean) => void } {
  const fixture = installLiveApi({ snapshot: { supported: true, slots, standbyByRepo } })
  const ui = (visible: boolean): React.JSX.Element => (
    <TooltipProvider>
      <SonarPanel isVisible={visible} />
    </TooltipProvider>
  )
  const view = render(ui(isVisible))
  return { ...fixture, rerenderVisible: (visible) => view.rerender(ui(visible)) }
}

beforeEach(() => {
  vi.useFakeTimers()
  seedApp()
})

afterEach(() => {
  cleanup()
  removeLiveApi()
  vi.useRealTimers()
})

describe('SonarPanel', () => {
  it('shows the unsupported state without an api', () => {
    removeLiveApi()
    render(<SonarPanel isVisible />)
    expect(screen.getByText(liveLabel('panelUnsupported'))).toBeTruthy()
  })

  it('shows the empty state when no project has slots', async () => {
    mount([])
    await settle()
    expect(screen.getByText(liveLabel('panelEmpty'))).toBeTruthy()
  })

  it('lists projects in model order with their worktrees', async () => {
    mount([
      liveSlotFixture({ repoId: 'repo-2', slotId: 'w', port: 3100 }),
      liveSlotFixture({ repoId: 'repo-1', slotId: 'web', port: 3000 })
    ])
    await settle()
    const headers = screen.getAllByRole('button', { expanded: true }).map((b) => b.textContent)
    expect(headers[0]).toContain('Alpha')
    expect(screen.getByText('feature')).toBeTruthy()
  })

  it('serves a worktree on click and ignores the serving row', async () => {
    const { calls } = mount([liveSlotFixture({ worktreeId: main.id, phase: 'live', startedAt: 1 })])
    await settle()
    const current = screen.getByRole('button', { name: /main/ })
    expect(current.getAttribute('data-current')).toBe('true')
    expect(current.getAttribute('aria-current')).toBe('true')
    fireEvent.click(current)
    expect(callsTo(calls, 'project')).toEqual([])
    const other = screen.getByRole('button', { name: /feature/ })
    expect(other.getAttribute('title')).toBe(liveLabel('serveOn', { port: 3000 }))
    fireEvent.click(other)
    await settle()
    expect(callsTo(calls, 'project')).toEqual([
      { repoId: 'repo-1', slotId: 'web', worktreeId: feature.id }
    ])
  })

  it('lets you pick the slot when the project has several', async () => {
    const { calls } = mount([
      liveSlotFixture({ slotId: 'web', port: 3000, label: 'Web' }),
      liveSlotFixture({ slotId: 'api', port: 3001, label: 'Api' })
    ])
    await settle()
    const row = screen.getByRole('button', { name: /feature/ })
    fireEvent.keyDown(row, { key: 'Enter' })
    await settle()
    expect(screen.getByRole('menuitem', { name: /:3000/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: /:3001/ }))
    await settle()
    expect(callsTo(calls, 'project')).toEqual([
      { repoId: 'repo-1', slotId: 'api', worktreeId: feature.id }
    ])
  })

  it('lists only served and standby worktrees', async () => {
    mount([liveSlotFixture({ worktreeId: main.id, phase: 'live', startedAt: 1 })])
    await settle()
    expect(screen.getByRole('button', { name: /main/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /feature/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /spare/ })).toBeNull()
  })

  it('dismisses a standby row and offers no x on a serving row', async () => {
    const { calls } = mount([liveSlotFixture({ worktreeId: main.id, phase: 'live', startedAt: 1 })])
    await settle()
    const buttons = screen.getAllByRole('button', { name: liveLabel('dismissStandby') })
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0])
    await settle()
    expect(callsTo(calls, 'dismissStandby')).toEqual([{ repoId: 'repo-1', worktreeId: feature.id }])
  })

  it('serves another worktree from the menu on a single-slot project', async () => {
    const { calls } = mount([liveSlotFixture({ worktreeId: main.id, phase: 'live', startedAt: 1 })])
    await settle()
    fireEvent.keyDown(screen.getByRole('button', { name: liveLabel('serveAnother') }), {
      key: 'Enter'
    })
    await settle()
    expect(screen.queryByRole('menuitem', { name: /feature/ })).toBeNull()
    fireEvent.click(screen.getByRole('menuitem', { name: /spare/ }))
    await settle()
    expect(callsTo(calls, 'project')).toEqual([
      { repoId: 'repo-1', slotId: 'web', worktreeId: spare.id }
    ])
  })

  it('offers a port submenu for another worktree on a multi-slot project', async () => {
    const { calls } = mount([
      liveSlotFixture({ slotId: 'web', port: 3000, label: 'Web' }),
      liveSlotFixture({ slotId: 'api', port: 3001, label: 'Api' })
    ])
    await settle()
    fireEvent.keyDown(screen.getByRole('button', { name: liveLabel('serveAnother') }), {
      key: 'Enter'
    })
    await settle()
    fireEvent.keyDown(screen.getByRole('menuitem', { name: /spare/ }), { key: 'ArrowRight' })
    await settle()
    expect(screen.getByRole('menuitem', { name: /:3000/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: /:3001/ }))
    await settle()
    expect(callsTo(calls, 'project')).toEqual([
      { repoId: 'repo-1', slotId: 'api', worktreeId: spare.id }
    ])
  })

  it('renders flush headers on the sidebar surface', async () => {
    mount([liveSlotFixture({ repoId: 'repo-1' })])
    await settle()
    const header = screen.getByRole('button', { name: /Alpha/ })
    expect(header.className).toContain('bg-sidebar')
    expect(header.className).not.toContain('bg-background')
    expect(header.parentElement?.className ?? '').not.toContain('pt-2')
  })

  it('shows logs on toggle and stops polling when hidden', async () => {
    const fixture = mount([liveSlotFixture({ phase: 'live', worktreeId: main.id })])
    fixture.api.logs = async (args) => {
      fixture.calls.push({ method: 'logs', args })
      return { lines: ['listening on 3000'], truncated: false, phase: 'live' }
    }
    await settle()
    fireEvent.click(screen.getByRole('button', { name: liveLabel('showLogs') }))
    await settle()
    expect(screen.getByText('listening on 3000')).toBeTruthy()
    expect(callsTo(fixture.calls, 'logs')[0]).toEqual({
      repoId: 'repo-1',
      slotId: 'web',
      limit: 200
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    const before = callsTo(fixture.calls, 'logs').length
    expect(before).toBeGreaterThan(1)
    fixture.rerenderVisible(false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(callsTo(fixture.calls, 'logs').length).toBe(before)
  })
})
