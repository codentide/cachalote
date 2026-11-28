export const NARWHAL_CHAT_HANDOFF_CHANNELS = {
  chatToTerminal: 'narwhal-chat-handoff:chat-to-terminal',
  terminalShellAlone: 'narwhal-chat-handoff:terminal-shell-alone'
} as const

/** `window.api.narwhalChatHandoff`; absent in the web client. */
export type NarwhalChatHandoffApi = {
  /** Cedes the chat's conversation to a terminal: resolves once the chat's agent has proven exit. */
  chatToTerminal: (sessionId: string) => Promise<void>
  /** Whether the pane's shell is alone by the test chat adoption applies; null when unreadable here. */
  terminalShellAlone: (ptyId: string) => Promise<boolean | null>
}
