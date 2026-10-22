export const CACHALOTE_CHAT_HANDOFF_CHANNELS = {
  chatToTerminal: 'cachalote-chat-handoff:chat-to-terminal',
  terminalShellAlone: 'cachalote-chat-handoff:terminal-shell-alone'
} as const

/** `window.api.cachaloteChatHandoff`; absent in the web client. */
export type CachaloteChatHandoffApi = {
  /** Cedes the chat's conversation to a terminal: resolves once the chat's agent has proven exit. */
  chatToTerminal: (sessionId: string) => Promise<void>
  /** Whether the pane's shell is alone by the test chat adoption applies; null when unreadable here. */
  terminalShellAlone: (ptyId: string) => Promise<boolean | null>
}
