import { mainI18n } from '../../i18n/main-i18n'
import { renameAppInCatalog } from '../../../shared/cachalote/i18n/app-name-catalog'

// Imported for its effect before the app menu is built: About and Hide name the app.
renameAppInCatalog(mainI18n, { 'menu.about': 'About Orca', 'menu.hide': 'Hide Orca' })
