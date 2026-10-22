import { ipcRenderer } from 'electron'
import {
  CACHALOTE_CHAT_HANDOFF_CHANNELS,
  type CachaloteChatHandoffApi
} from '../../shared/cachalote/chat-handoff/chat-handoff-ipc'

export const cachaloteChatHandoffApi = {
  chatToTerminal: (sessionId) =>
    ipcRenderer.invoke(CACHALOTE_CHAT_HANDOFF_CHANNELS.chatToTerminal, sessionId),
  terminalShellAlone: (ptyId) =>
    ipcRenderer.invoke(CACHALOTE_CHAT_HANDOFF_CHANNELS.terminalShellAlone, ptyId)
} satisfies CachaloteChatHandoffApi
