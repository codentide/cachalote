import * as rendererI18n from '@/i18n/i18n'

// Fork-only strings: upstream's catalogs are generated, so these switch on the UI language here.
const LABELS = {
  field: { es: 'Formato de rama', en: 'Branch format' },
  settingsTitle: { es: 'Formato de rama', en: 'Branch format' },
  settingsDescription: {
    es: 'Plantilla para nombrar las ramas de los worktrees nuevos de este proyecto. {task-id} es un campo del diálogo de crear (si lo dejás vacío, sale del nombre: AX-1234); el resto son las variables de abajo.',
    en: "Template for naming this project's new worktree branches. {task-id} is a field in the create dialog (left empty, it comes from the name: AX-1234); the rest are the variables below."
  },
  template: { es: 'Plantilla', en: 'Template' },
  templatePlaceholder: { es: '{type}/{task-id}', en: '{type}/{task-id}' },
  preview: { es: 'Vista previa', en: 'Preview' },
  formatOff: {
    es: 'Sin plantilla: Orca nombra la rama como siempre.',
    en: 'No template: Orca names the branch as usual.'
  },
  undefinedVariables: {
    es: 'Sin definir abajo, se pedirán como texto:',
    en: 'Not defined below, asked for as text:'
  },
  variables: { es: 'Variables de este proyecto', en: "This project's variables" },
  variableName: { es: 'Nombre', en: 'Name' },
  variableKind: { es: 'Tipo', en: 'Type' },
  kindSelect: { es: 'Lista', en: 'List' },
  kindText: { es: 'Texto', en: 'Text' },
  variableOptions: { es: 'Opciones, separadas por coma', en: 'Options, comma-separated' },
  addVariable: { es: 'Agregar variable', en: 'Add variable' },
  removeVariable: { es: 'Quitar variable', en: 'Remove variable' },
  save: { es: 'Guardar', en: 'Save' },
  reset: { es: 'Restablecer', en: 'Reset' },
  'invalid-name': {
    es: 'Nombre en minúsculas, letras, números y guiones (empieza con letra).',
    en: 'Lowercase name: letters, digits and dashes, starting with a letter.'
  },
  'duplicate-name': {
    es: 'Ya hay una variable con ese nombre.',
    en: 'Another variable has this name.'
  },
  'reserved-name': {
    es: 'task-id ya existe: sale del nombre del worktree.',
    en: 'task-id is built in: it comes from the worktree name.'
  },
  'missing-options': {
    es: 'Una lista necesita al menos una opción.',
    en: 'A list needs at least one option.'
  },
  'invalid-option': {
    es: 'Cada opción va sin espacios ni barras (letras, números, . _ -).',
    en: 'Each option takes no spaces or slashes (letters, digits, . _ -).'
  }
} as const

export type BranchFormatLabelKey = keyof typeof LABELS

function uiLanguage(): string {
  // Tests that mock the i18n module with `translate` only throw on the instance.
  try {
    return rendererI18n.i18n.language ?? 'en'
  } catch {
    return 'en'
  }
}

export function branchFormatLabel(key: BranchFormatLabelKey): string {
  return uiLanguage().startsWith('es') ? LABELS[key].es : LABELS[key].en
}
