import type { i18n as I18nInstance } from 'i18next'
import { i18n as appI18n } from '../../i18n/i18n'
import { CACHALOTE_APP_NAME } from '../../../../shared/cachalote/cachalote-name'

// Upstream reads the app name from these catalog keys. Overriding the strings, instead of the JSX,
// leaves the titlebar and the empty-state screen untouched, so upstream can rework them freely.
const APP_NAME_STRINGS: Readonly<Record<string, string>> = {
  'auto.App.5096cbbc86': CACHALOTE_APP_NAME,
  'auto.components.Landing.6ca6ff404e': CACHALOTE_APP_NAME.toUpperCase(),
  'auto.components.Landing.520304a067': `${CACHALOTE_APP_NAME} logo`
}

function rename(i18n: I18nInstance, language: string): void {
  for (const [key, value] of Object.entries(APP_NAME_STRINGS)) {
    if (i18n.getResource(language, 'translation', key) !== value) {
      i18n.addResource(language, 'translation', key, value)
    }
  }
}

/** Names the app in every catalog, including the ones that load later (lazy locales, plugin packs). */
export function installCachaloteAppNameStrings(i18n: I18nInstance): void {
  const install = (): void => {
    for (const language of Object.keys(i18n.store.data)) {
      rename(i18n, language)
    }
    // The guard in rename stops the loop: its own adds fire 'added' again and find the names set.
    i18n.store.on('added', (language: string) => rename(i18n, language))
  }
  if (i18n.store) {
    install()
  } else {
    i18n.on('initialized', install)
  }
}

// Imported for its effect from the app root.
installCachaloteAppNameStrings(appI18n)
