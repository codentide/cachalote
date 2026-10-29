import type { i18n as I18nInstance } from 'i18next'
import { CACHALOTE_APP_NAME } from '../cachalote-name'

/**
 * Renames the app inside upstream's own strings (key → upstream's English fallback), in every
 * catalog, including ones that load later (lazy locales, plugin packs). Each language keeps its
 * wording: "Acerca de Orca" becomes "Acerca de Cachalot". Upstream's JSX and menus stay untouched.
 */
export function renameAppInCatalog(
  i18n: I18nInstance,
  upstreamStrings: Readonly<Record<string, string>>
): void {
  const rename = (language: string): void => {
    for (const [key, fallback] of Object.entries(upstreamStrings)) {
      const current = i18n.getResource(language, 'translation', key)
      const base = typeof current === 'string' ? current : fallback
      const renamed = base
        .replaceAll('ORCA', CACHALOTE_APP_NAME.toUpperCase())
        .replaceAll('Orca', CACHALOTE_APP_NAME)
      if (current !== renamed) {
        i18n.addResource(language, 'translation', key, renamed)
      }
    }
  }
  const install = (): void => {
    for (const language of Object.keys(i18n.store.data)) {
      rename(language)
    }
    // The guard in rename stops the loop: its own adds fire 'added' again and find the names set.
    i18n.store.on('added', (language: string) => rename(language))
  }
  if (i18n.store) {
    install()
  } else {
    i18n.on('initialized', install)
  }
}
