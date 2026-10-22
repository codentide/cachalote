import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { readIpcErrorMessage } from '@/lib/ipc-error'
import { buildAiVaultResumeStartupForWorktree } from '@/lib/ai-vault-resume-command'
import { launchAiVaultSessionInNewTab } from '@/lib/launch-ai-vault-session'
import { insertUnifiedTabAfterAnchor } from '@/lib/unified-tab-anchor-insertion'
import {
  prepareNativeChatCliFork,
  type NativeChatCliForkSubject
} from '@/lib/native-chat-cli-fork-preparation'
import { parseExecutionHostId } from '../../../../shared/execution-host'
import { structuredAgentSessionPaneKey } from '../../../../shared/structured-agent-session-projection'
import { chatHandoffText } from './chat-handoff-text'

const pending = new Set<string>()
const listeners = new Set<() => void>()
const changed = (): void => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCachaloteChatToTerminalPending(sessionId: string | null): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !!sessionId && pending.has(sessionId),
    () => false
  )
}

// A reply or question in flight: ceding now would cut the agent off mid-turn.
function chatIsBusy(tabId: string, sessionId: string): boolean {
  const status =
    useAppStore.getState().agentStatusByPaneKey[structuredAgentSessionPaneKey(tabId, sessionId)]
      ?.state
  return status !== undefined && status !== 'done'
}

/**
 * Moves a local Claude chat's conversation back to a terminal, same session id: main proves the
 * chat's agent exited and marks the chat ceded before the terminal resumes it in the chat's slot.
 */
export async function runCachaloteChatToTerminal(args: {
  subject: NativeChatCliForkSubject
  tab: { id: string; worktreeId: string }
  onComplete?: () => void
}): Promise<void> {
  const { subject, tab } = args
  const api = window.api.cachaloteChatHandoff
  if (!api || pending.has(subject.sessionId)) {
    return
  }
  if (parseExecutionHostId(subject.request.executionHostScope)?.kind !== 'local') {
    toast.error(chatHandoffText('onlyLocalClaude'))
    return
  }
  if (chatIsBusy(tab.id, subject.sessionId)) {
    toast.error(chatHandoffText('chatBusy'))
    return
  }
  pending.add(subject.sessionId)
  changed()
  let ceded = false
  try {
    const prepared = await prepareNativeChatCliFork(subject, {
      isCurrent: () => true,
      signal: new AbortController().signal
    })
    // Agents whose fork copies the conversation have no shared session id to hand back.
    if (prepared.copied || prepared.session.agent !== 'claude') {
      toast.error(chatHandoffText('onlyLocalClaude'))
      return
    }
    await api.chatToTerminal(subject.sessionId)
    ceded = true
    const state = useAppStore.getState()
    const startup = buildAiVaultResumeStartupForWorktree({
      state,
      worktreeId: subject.workspaceId,
      session: prepared.session,
      commandOverride: state.settings?.agentCmdOverrides?.claude
    })
    const launch = launchAiVaultSessionInNewTab({
      agent: 'claude',
      worktreeId: subject.workspaceId,
      ...startup
    })
    if (launch.tabId) {
      insertUnifiedTabAfterAnchor(subject.workspaceId, launch.tabId, tab.id)
    }
    useAppStore.getState().closeUnifiedTab(tab.id)
  } catch (error) {
    toast.error(chatHandoffText(ceded ? 'terminalLaunchFailed' : 'chatToTerminalFailed'), {
      description: readIpcErrorMessage(error)
    })
  } finally {
    pending.delete(subject.sessionId)
    changed()
    args.onComplete?.()
  }
}
