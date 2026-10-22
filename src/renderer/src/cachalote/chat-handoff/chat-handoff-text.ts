import * as rendererI18n from '@/i18n/i18n'

const TEXT = {
  chatToTerminal: {
    es: 'Volver a la terminal (misma conversación)',
    en: 'Back to Terminal (same conversation)'
  },
  chatToTerminalTooltip: {
    es: 'Cierra este chat y sigue la misma conversación en una terminal, sin copiarla.',
    en: 'Closes this chat and continues the same conversation in a terminal, without copying it.'
  },
  chatBusy: {
    es: 'El chat está trabajando: esperá a que termine o cancelalo antes de volver a la terminal.',
    en: 'The chat is working: wait for it to finish or cancel it before going back to the terminal.'
  },
  onlyLocalClaude: {
    es: 'Solo los chats locales de Claude vuelven a la terminal con la misma conversación.',
    en: 'Only local Claude chats go back to a terminal with the same conversation.'
  },
  chatToTerminalFailed: {
    es: 'No se pudo volver a la terminal; el chat sigue abierto.',
    en: 'Could not go back to the terminal; the chat stays open.'
  },
  terminalLaunchFailed: {
    es: 'El chat ya cedió la conversación, pero la terminal no arrancó: reanudala desde el historial de sesiones.',
    en: 'The chat already handed the conversation over, but the terminal did not start: resume it from Session History.'
  },
  agentStillRunning: {
    es: 'Claude no salió de la terminal a tiempo; probá /exit a mano y volvé a intentar.',
    en: 'Claude did not leave the terminal in time; try /exit by hand and retry.'
  }
} as const

export type ChatHandoffTextKey = keyof typeof TEXT

export function chatHandoffText(key: ChatHandoffTextKey): string {
  // Tests that mock this module with `translate` only would throw on the instance.
  try {
    return rendererI18n.i18n.language?.startsWith('es') ? TEXT[key].es : TEXT[key].en
  } catch {
    return TEXT[key].en
  }
}
