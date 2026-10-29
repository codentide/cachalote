import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'
import { i18n as appI18n } from '../../i18n/i18n'
import { installCachaloteAppNameStrings } from './app-name-translation'

const upstreamStrings = {
  auto: {
    App: { '5096cbbc86': 'Orca' },
    components: { Landing: { '6ca6ff404e': 'ORCA', '520304a067': 'Orca logo' } }
  }
}

describe('app name translation', () => {
  const i18n = i18next.createInstance()

  beforeAll(async () => {
    installCachaloteAppNameStrings(i18n)
    await i18n.init({ lng: 'en', resources: { en: { translation: upstreamStrings } } })
  })

  it('renames the app in the catalogs already loaded', () => {
    expect(i18n.t('auto.App.5096cbbc86', { lng: 'en' })).toBe('Cachalot')
    expect(i18n.t('auto.components.Landing.6ca6ff404e', { lng: 'en' })).toBe('CACHALOT')
    expect(i18n.t('auto.components.Landing.520304a067', { lng: 'en' })).toBe('Cachalot logo')
  })

  it('renames it in a catalog that loads later, even one that ships the upstream name', () => {
    i18n.addResourceBundle('es', 'translation', upstreamStrings, true, true)
    expect(i18n.t('auto.App.5096cbbc86', { lng: 'es' })).toBe('Cachalot')
    expect(i18n.t('auto.components.Landing.6ca6ff404e', { lng: 'es' })).toBe('CACHALOT')
  })

  it("applies to the app's own i18n instance, the one upstream's components read", () => {
    expect(appI18n.t('auto.App.5096cbbc86', { defaultValue: 'Orca' })).toBe('Cachalot')
  })
})
