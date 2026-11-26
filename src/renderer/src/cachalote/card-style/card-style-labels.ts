import * as rendererI18n from '@/i18n/i18n'

// Fork-only strings: upstream's catalogs are generated, so these switch on the UI language here.
const LABELS = {
  option: { es: 'Cachalote', en: 'Cachalote' },
  primary: { es: 'Worktree principal', en: 'Primary worktree' },
  childWorktrees: { es: 'Worktrees hijos', en: 'Child worktrees' },
  otherAgents: { es: 'Agentes más', en: 'More agents' }
} as const

function uiLanguage(): string {
  // Sidebar tests mock this module with `translate` only; reading the instance there throws.
  try {
    return rendererI18n.i18n.language ?? 'en'
  } catch {
    return 'en'
  }
}

export function cardStyleLabel(key: keyof typeof LABELS): string {
  return uiLanguage().startsWith('es') ? LABELS[key].es : LABELS[key].en
}
