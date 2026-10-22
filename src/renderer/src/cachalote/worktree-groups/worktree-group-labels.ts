import * as rendererI18n from '@/i18n/i18n'

// Matches upstream's parent-picker deferral: open prompts once the closing menu has returned focus.
export const AFTER_MENU_CLOSE_MS = 200

// Fork-only strings: upstream's catalogs are generated, so these switch on the UI language here.
const LABELS = {
  menu: { es: 'Grupo de worktrees', en: 'Worktree Group' },
  newGroup: { es: 'Nuevo grupo de worktrees', en: 'New Worktree Group' },
  defaultName: { es: 'Nuevo grupo', en: 'New group' },
  remove: { es: 'Sacar del grupo de worktrees', en: 'Remove from Worktree Group' },
  rename: { es: 'Renombrar grupo', en: 'Rename Group' },
  ungroup: { es: 'Desagrupar', en: 'Ungroup' },
  save: { es: 'Guardar', en: 'Save' },
  color: { es: 'Color', en: 'Color' },
  icon: { es: 'Ícono', en: 'Icon' },
  composerField: { es: 'Grupo de worktrees', en: 'Worktree group' },
  noGroup: { es: 'Sin grupo', en: 'No group' },
  newGroupOption: { es: 'Nuevo grupo…', en: 'New group…' },
  groupName: { es: 'Nombre del grupo', en: 'Group name' }
} as const

function uiLanguage(): string {
  // Sidebar tests mock this module with `translate` only; reading the instance there throws.
  try {
    return rendererI18n.i18n.language ?? 'en'
  } catch {
    return 'en'
  }
}

export function worktreeGroupLabel(key: keyof typeof LABELS): string {
  return uiLanguage().startsWith('es') ? LABELS[key].es : LABELS[key].en
}
