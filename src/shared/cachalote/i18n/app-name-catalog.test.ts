import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'
import { renameAppInCatalog } from './app-name-catalog'

const upstream = { 'menu.about': 'About Orca', 'landing.title': 'ORCA' }

describe('renameAppInCatalog', () => {
  const i18n = i18next.createInstance()

  beforeAll(async () => {
    renameAppInCatalog(i18n, upstream)
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  })

  it('renames the English strings, keeping the case upstream used', () => {
    expect(i18n.t('menu.about')).toBe('About Cachalot')
    expect(i18n.t('landing.title')).toBe('CACHALOT')
  })

  it('renames a catalog that loads later in its own wording', () => {
    i18n.addResourceBundle(
      'es',
      'translation',
      { menu: { about: 'Acerca de Orca' }, landing: { title: 'ORCA' } },
      true,
      true
    )
    expect(i18n.t('menu.about', { lng: 'es' })).toBe('Acerca de Cachalot')
    expect(i18n.t('landing.title', { lng: 'es' })).toBe('CACHALOT')
  })
})
