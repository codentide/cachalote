import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { getPtyIdForPaneKey } from '@/hooks/pane-key-pty-id'
import {
  confirmRuntimeTerminalForegroundProcess,
  sendRuntimePtyInput
} from '@/runtime/runtime-terminal-inspection'
import type { CliChatResumeSource } from '@/components/tab-bar/cli-chat-resume-source'
import { reportCliChatResumeFailure } from '@/components/tab-bar/cli-chat-resume-feedback'
import { adoptingAgentOnHost } from '@/components/right-sidebar/ai-vault-session-resume-in-chat-launch'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session-launch-plan'
import { beginStructuredAgentSessionProvisionalLaunch } from '@/lib/agent-session/structured-agent-session-provisional-tab'
import { structuredAgentSessionTargetForHost } from '@/runtime/structured-agent-session-owner'
import { isShellProcess } from '../../../../shared/shell-process-detection'
import { chatHandoffText } from './chat-handoff-text'

type TerminalToChatTiming = {
  pollMs: number
  timeoutMs: number
  sleep: (ms: number) => Promise<void>
}

const DEFAULT_TIMING: TerminalToChatTiming = {
  pollMs: 300,
  timeoutMs: 15_000,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}

// A null read (unreadable, remote, old preload) is no evidence of a shell.
async function readForeground(ptyId: string): Promise<{ name: string | null; isShell: boolean }> {
  const name = await confirmRuntimeTerminalForegroundProcess(ptyId)
  return { name, isShell: name !== null && isShellProcess(name) }
}

// Counting polls instead of reading the clock keeps an injected sleep deterministic.
async function pollUntil(
  check: () => Promise<boolean>,
  timing: TerminalToChatTiming
): Promise<boolean> {
  const polls = Math.ceil(timing.timeoutMs / timing.pollMs)
  for (let poll = 0; poll < polls; poll += 1) {
    await timing.sleep(timing.pollMs)
    if (await check()) {
      return true
    }
  }
  return false
}

// Main's own census; an unreadable pane (null) is left for main to judge.
async function shellAlone(ptyId: string): Promise<boolean> {
  const alone = await window.api.cachaloteChatHandoff?.terminalShellAlone(ptyId).catch(() => null)
  return alone !== false
}

// Safe default: an unknown or split layout keeps the terminal, since closing it would kill sibling panes.
function terminalTabHasSinglePane(terminalTabId: string): boolean {
  return useAppStore.getState().terminalLayoutsByTabId[terminalTabId]?.root?.type === 'leaf'
}

function closeTerminalTab(source: CliChatResumeSource): void {
  if (!terminalTabHasSinglePane(source.tabId)) {
    return
  }
  const tabs = useAppStore.getState().unifiedTabsByWorktree[source.workspaceId] ?? []
  // The terminal's unified tab points at its legacy terminal tab through entityId.
  const terminal = tabs.find(
    (tab) => tab.contentType === 'terminal' && tab.entityId === source.tabId
  )
  if (terminal) {
    useAppStore.getState().closeUnifiedTab(terminal.id)
  }
}

/**
 * Moves a terminal's Claude conversation into the native chat, same session id: the agent is
 * asked to exit first so the terminal and the chat never write the conversation together.
 */
export async function runCachaloteTerminalToChat(
  source: CliChatResumeSource,
  timing: Partial<TerminalToChatTiming> = {}
): Promise<void> {
  const ptyId = getPtyIdForPaneKey(source.paneKey)
  if (ptyId) {
    const wait = { ...DEFAULT_TIMING, ...timing }
    const foreground = await readForeground(ptyId)
    if (!foreground.isShell) {
      // Resuming while the agent still holds the session would fork the conversation.
      if (foreground.name !== null) {
        sendRuntimePtyInput(ptyId, '/exit\r', 'driving')
      }
      if (!(await pollUntil(async () => (await readForeground(ptyId)).isShell, wait))) {
        toast.error(chatHandoffText('agentStillRunning'))
        return
      }
    }
    // The prompt hooks a shell runs right after the agent exits make main's census refuse.
    if (!(await shellAlone(ptyId)) && !(await pollUntil(() => shellAlone(ptyId), wait))) {
      toast.error(chatHandoffText('agentStillRunning'))
      return
    }
  }
  if (await openChatForExitedTerminal(source)) {
    closeTerminalTab(source)
  }
}

/** Whether Cachalote takes over upstream's runCliChatResume: local Claude in the desktop app. */
export function isCachaloteTerminalToChat(source: CliChatResumeSource): boolean {
  // The web client and unit tests have no Cachalote bridge, so they keep upstream's flow.
  return (
    source.agent === 'claude' && typeof window !== 'undefined' && !!window.api?.cachaloteChatHandoff
  )
}

/**
 * Upstream's runCliChatResume, minus its live-agent check: that one aborts as soon as the pane's
 * agent exits, which is exactly the state main requires before adopting the conversation. No
 * cliSource either: main resolves it from the pane's status row, which goes away with the agent;
 * by id alone main still censuses every terminal the conversation ran in, as Session History does.
 */
async function openChatForExitedTerminal(source: CliChatResumeSource): Promise<boolean> {
  const target = structuredAgentSessionTargetForHost(source.executionHostId)
  if (!target || target.kind !== 'local') {
    return false
  }
  try {
    const agent = await adoptingAgentOnHost(source.agent, source.workspaceId)
    const plan = adoptAgentSessionLaunchVerdict({
      route: 'structured-native-chat',
      requestId: newAgentLaunchRequestId(),
      agent,
      worktreeId: source.workspaceId,
      executionHostId: source.executionHostId,
      resumeFrom: { providerSessionId: source.providerSessionId }
    })
    const launch = beginStructuredAgentSessionProvisionalLaunch({
      plan,
      hooks: { beforeCreate: () => true },
      deferPublication: true
    })
    if (!launch) {
      return false
    }
    const result = await launch.settlement
    if (result.kind === 'failed' && !result.notified) {
      await reportCliChatResumeFailure(source, result.error, true, target)
    }
    return result.kind === 'structured'
  } catch (error) {
    await reportCliChatResumeFailure(source, error, false, target)
    return false
  }
}
