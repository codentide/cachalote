import { ipcRenderer } from 'electron'
import {
  NARWHAL_CHAT_HANDOFF_CHANNELS,
  type NarwhalChatHandoffApi
} from '../../shared/narwhal/chat-handoff/chat-handoff-ipc'

export const narwhalChatHandoffApi = {
  chatToTerminal: (sessionId) =>
    ipcRenderer.invoke(NARWHAL_CHAT_HANDOFF_CHANNELS.chatToTerminal, sessionId),
  terminalShellAlone: (ptyId) =>
    ipcRenderer.invoke(NARWHAL_CHAT_HANDOFF_CHANNELS.terminalShellAlone, ptyId)
} satisfies NarwhalChatHandoffApi
