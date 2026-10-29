import { describe, expect, it } from 'vitest'
import { translateMain } from '../../i18n/main-i18n'
import './app-name-menu'

describe('main menu app name', () => {
  it('names the app in About and Hide', () => {
    expect(translateMain('menu.about', 'About Orca')).toBe('About Cachalot')
    expect(translateMain('menu.hide', 'Hide Orca')).toBe('Hide Cachalot')
  })
})
