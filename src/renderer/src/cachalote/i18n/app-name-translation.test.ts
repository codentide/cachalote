import { describe, expect, it } from 'vitest'
import { i18n } from '../../i18n/i18n'
import './app-name-translation'

describe('renderer app name', () => {
  it("names the app in the instance upstream's titlebar reads", () => {
    expect(i18n.t('auto.App.5096cbbc86', { defaultValue: 'Orca' })).toBe('Cachalot')
  })
})
