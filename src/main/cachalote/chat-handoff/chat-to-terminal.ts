import path from 'node:path'
import { app, ipcMain } from 'electron'
import { LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import { CACHALOTE_CHAT_HANDOFF_CHANNELS } from '../../../shared/cachalote/chat-handoff/chat-handoff-ipc'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/structured-agent-session-host'
import { getStructuredAgentSessionHost } from '../../native-chat/agent-session-wire/structured-agent-session-registry'
import {
  configureCachaloteCededChats,
  markCachaloteCededChat,
  unmarkCachaloteCededChat
} from './ceded-chats'
import { cachaloteTerminalShellAlone } from './terminal-shell-alone'

/**
 * Cedes a local Claude chat's conversation to a terminal. Marked before the close so nothing
 * restarts the chat meanwhile; the close resolves only once the agent's exit is proven, and a
 * close that cannot prove it leaves the chat the owner.
 */
export async function cedeChatToTerminal(
  host: StructuredAgentSessionHost | null,
  sessionId: string
): Promise<void> {
  const record = host?.deps.store.getRecord(sessionId)
  if (!host || !record) {
    throw new Error('This chat no longer exists.')
  }
  if (record.provider !== 'claude' || record.location.executionHostId !== LOCAL_EXECUTION_HOST_ID) {
    throw new Error('Only local Claude chats can go back to a terminal.')
  }
  markCachaloteCededChat(sessionId)
  try {
    await host.close(sessionId, 'user-close')
  } catch (error) {
    unmarkCachaloteCededChat(sessionId)
    throw error
  }
}

/** Registers the handoff IPC; a failure is logged and never stops the handlers after it. */
export function registerCachaloteChatHandoffHandlers(): void {
  try {
    configureCachaloteCededChats(path.join(app.getPath('userData'), 'cachalote-ceded-chats.json'))
    ipcMain.handle(CACHALOTE_CHAT_HANDOFF_CHANNELS.chatToTerminal, (_event, sessionId: unknown) => {
      if (typeof sessionId !== 'string' || !sessionId) {
        throw new Error('A chat session id is required.')
      }
      return cedeChatToTerminal(getStructuredAgentSessionHost(), sessionId)
    })
    ipcMain.handle(CACHALOTE_CHAT_HANDOFF_CHANNELS.terminalShellAlone, (_event, ptyId: unknown) =>
      typeof ptyId === 'string' && ptyId ? cachaloteTerminalShellAlone(ptyId) : null
    )
  } catch (error) {
    console.error(
      '[cachalote-chat-handoff] could not register; chats keep upstream behavior',
      error
    )
  }
}
