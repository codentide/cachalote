import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CliChatResumeSource } from '@/components/tab-bar/cli-chat-resume-source'

type FakeTab = { id: string; entityId: string; contentType: 'terminal' | 'agent-session' }
type FakeLayoutRoot = { type: 'leaf' | 'split' }
type Settlement = { kind: 'structured' } | { kind: 'failed'; notified: boolean; error: Error }

const mocks = vi.hoisted(() => {
  const unifiedTabsByWorktree: Record<string, FakeTab[]> = {}
  const terminalLayoutsByTabId: Record<string, { root: FakeLayoutRoot | null }> = {}
  return {
    state: { unifiedTabsByWorktree, terminalLayoutsByTabId, closeUnifiedTab: vi.fn() },
    getPtyIdForPaneKey: vi.fn(),
    confirmForeground: vi.fn(),
    sendInput: vi.fn(),
    target: vi.fn(),
    verdict: vi.fn(),
    beginLaunch: vi.fn(),
    reportFailure: vi.fn(),
    shellAlone: vi.fn(),
    toastError: vi.fn()
  }
})

vi.stubGlobal('window', { api: { cachaloteChatHandoff: { terminalShellAlone: mocks.shellAlone } } })

vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('@/hooks/pane-key-pty-id', () => ({ getPtyIdForPaneKey: mocks.getPtyIdForPaneKey }))
vi.mock('@/runtime/runtime-terminal-inspection', () => ({
  confirmRuntimeTerminalForegroundProcess: mocks.confirmForeground,
  sendRuntimePtyInput: mocks.sendInput
}))
vi.mock('@/runtime/structured-agent-session-owner', () => ({
  structuredAgentSessionTargetForHost: mocks.target
}))
vi.mock('@/components/right-sidebar/ai-vault-session-resume-in-chat-launch', () => ({
  adoptingAgentOnHost: async (agent: string) => agent
}))
vi.mock('@/lib/agent-launch-request-id', () => ({ newAgentLaunchRequestId: () => 'request-1' }))
vi.mock('@/lib/agent-session-launch-plan', () => ({
  adoptAgentSessionLaunchVerdict: mocks.verdict
}))
vi.mock('@/lib/agent-session/structured-agent-session-provisional-tab', () => ({
  beginStructuredAgentSessionProvisionalLaunch: mocks.beginLaunch
}))
vi.mock('@/components/tab-bar/cli-chat-resume-feedback', () => ({
  reportCliChatResumeFailure: mocks.reportFailure
}))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('./chat-handoff-text', () => ({ chatHandoffText: (key: string) => key }))

import { runCachaloteTerminalToChat } from './terminal-to-chat'

const SOURCE: CliChatResumeSource = {
  tabId: 'terminal-1',
  workspaceId: 'workspace-1',
  paneKey: 'terminal-1:leaf-1',
  agent: 'claude',
  providerSessionId: 'provider-session',
  executionHostId: 'local'
}
const TERMINAL_TAB: FakeTab = {
  id: 'unified-terminal',
  entityId: 'terminal-1',
  contentType: 'terminal'
}
const TIMING = { pollMs: 300, timeoutMs: 1_500, sleep: vi.fn(async () => {}) }

function settles(result: Settlement): void {
  mocks.beginLaunch.mockReturnValue({ settlement: Promise.resolve(result) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.unifiedTabsByWorktree = { [SOURCE.workspaceId]: [TERMINAL_TAB] }
  mocks.state.terminalLayoutsByTabId = { [SOURCE.tabId]: { root: { type: 'leaf' } } }
  mocks.getPtyIdForPaneKey.mockReturnValue('pty-1')
  mocks.target.mockReturnValue({ kind: 'local' })
  mocks.verdict.mockReturnValue({ plan: true })
  mocks.shellAlone.mockResolvedValue(true)
  settles({ kind: 'structured' })
})

describe('runCachaloteTerminalToChat', () => {
  it('opens the chat straight away when the shell is already in the foreground', async () => {
    mocks.confirmForeground.mockResolvedValue('zsh')
    await runCachaloteTerminalToChat(SOURCE, TIMING)
    expect(mocks.sendInput).not.toHaveBeenCalled()
    expect(mocks.beginLaunch).toHaveBeenCalledTimes(1)
  })

  it('adopts the same conversation by its id alone', async () => {
    mocks.confirmForeground.mockResolvedValue('zsh')
    await runCachaloteTerminalToChat(SOURCE, TIMING)
    expect(mocks.verdict).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'structured-native-chat',
        agent: 'claude',
        worktreeId: SOURCE.workspaceId,
        resumeFrom: { providerSessionId: SOURCE.providerSessionId }
      })
    )
  })

  it('asks claude to exit once and opens the chat when the shell takes over', async () => {
    mocks.confirmForeground
      .mockResolvedValueOnce('claude')
      .mockResolvedValueOnce('claude')
      .mockResolvedValueOnce(null)
      .mockResolvedValue('/bin/zsh')
    await runCachaloteTerminalToChat(SOURCE, TIMING)
    expect(mocks.sendInput).toHaveBeenCalledExactlyOnceWith('pty-1', '/exit\r', 'driving')
    expect(mocks.confirmForeground).toHaveBeenCalledTimes(4)
    expect(mocks.beginLaunch).toHaveBeenCalledTimes(1)
  })

  it('tells the user and opens nothing when claude never exits', async () => {
    mocks.confirmForeground.mockResolvedValue('claude')
    await runCachaloteTerminalToChat(SOURCE, TIMING)
    expect(mocks.sendInput).toHaveBeenCalledTimes(1)
    expect(mocks.toastError).toHaveBeenCalledExactlyOnceWith('agentStillRunning')
    expect(mocks.beginLaunch).not.toHaveBeenCalled()
  })

  it('waits for the prompt hooks to leave the shell alone before opening the chat', async () => {
    mocks.confirmForeground.mockResolvedValue('zsh')
    mocks.shellAlone
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true)
    await runCachaloteTerminalToChat(SOURCE, TIMING)
    expect(mocks.shellAlone).toHaveBeenCalledTimes(3)
    expect(mocks.beginLaunch).toHaveBeenCalledTimes(1)
  })

  it('gives up when the shell never ends up alone', async () => {
    mocks.confirmForeground.mockResolvedValue('zsh')
    mocks.shellAlone.mockResolvedValue(false)
    await runCachaloteTerminalToChat(SOURCE, TIMING)
    expect(mocks.toastError).toHaveBeenCalledExactlyOnceWith('agentStillRunning')
    expect(mocks.beginLaunch).not.toHaveBeenCalled()
  })

  it('leaves an unreadable pane for main to judge', async () => {
    mocks.confirmForeground.mockResolvedValue('zsh')
    mocks.shellAlone.mockResolvedValue(null)
    await runCachaloteTerminalToChat(SOURCE, TIMING)
    expect(mocks.beginLaunch).toHaveBeenCalledTimes(1)
  })

  it('closes the single-pane terminal tab once the chat opened', async () => {
    mocks.confirmForeground.mockResolvedValue('zsh')
    await runCachaloteTerminalToChat(SOURCE, TIMING)
    expect(mocks.state.closeUnifiedTab).toHaveBeenCalledExactlyOnceWith(TERMINAL_TAB.id)
  })

  it('keeps a split terminal tab even when the chat opened', async () => {
    mocks.confirmForeground.mockResolvedValue('zsh')
    mocks.state.terminalLayoutsByTabId = { [SOURCE.tabId]: { root: { type: 'split' } } }
    await runCachaloteTerminalToChat(SOURCE, TIMING)
    expect(mocks.state.closeUnifiedTab).not.toHaveBeenCalled()
  })

  it('keeps the terminal and reports a refusal main did not already toast', async () => {
    mocks.confirmForeground.mockResolvedValue('zsh')
    const error = new Error('agent_session_conflict')
    settles({ kind: 'failed', notified: false, error })
    await runCachaloteTerminalToChat(SOURCE, TIMING)
    expect(mocks.reportFailure).toHaveBeenCalledWith(SOURCE, error, true, { kind: 'local' })
    expect(mocks.state.closeUnifiedTab).not.toHaveBeenCalled()
  })

  it('does nothing on a host that is not local', async () => {
    mocks.confirmForeground.mockResolvedValue('zsh')
    mocks.target.mockReturnValue({ kind: 'environment', environmentId: 'env-1' })
    await runCachaloteTerminalToChat(SOURCE, TIMING)
    expect(mocks.beginLaunch).not.toHaveBeenCalled()
    expect(mocks.state.closeUnifiedTab).not.toHaveBeenCalled()
  })
})
