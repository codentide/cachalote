import * as rendererI18n from '@/i18n/i18n'

// Fork-only strings: upstream's catalogs are generated, so these switch on the UI language here.
const LABELS = {
  name: { es: 'Sonar', en: 'Sonar' },
  // Pill and phases
  phaseIdle: { es: 'Libre', en: 'Idle' },
  phaseSyncing: { es: 'Sincronizando', en: 'Syncing' },
  phaseStarting: { es: 'Arrancando', en: 'Starting' },
  phaseLive: { es: 'En vivo', en: 'Live' },
  phaseCrashed: { es: 'Caído', en: 'Crashed' },
  phasePortBusy: { es: 'Puerto ocupado', en: 'Port busy' },
  pillAria: { es: 'En vivo en el puerto {port}', en: 'Live on port {port}' },
  popoverPort: { es: 'Puerto', en: 'Port' },
  popoverPhase: { es: 'Estado', en: 'Status' },
  popoverError: { es: 'Error', en: 'Error' },
  openInBrowser: { es: 'Abrir en el navegador', en: 'Open in browser' },
  viewLogs: { es: 'Ver logs', en: 'View logs' },
  stop: { es: 'Detener', en: 'Stop' },
  // Context menu
  serveOn: { es: 'Poner en vivo en :{port}', en: 'Serve live on :{port}' },
  serveOnMenu: { es: 'Poner en vivo en…', en: 'Serve live on…' },
  stopServing: { es: 'Dejar de servir :{port}', en: 'Stop serving :{port}' },
  // Group
  groupServe: { es: 'Poner grupo en vivo', en: 'Serve group live' },
  groupServeAmbiguous: {
    es: 'Hay más de un destino posible: usá el menú de cada worktree.',
    en: 'More than one target is possible: use each worktree menu.'
  },
  groupSummaryAria: {
    es: '{live} de {total} en vivo',
    en: '{live} of {total} live'
  },
  // Status bar
  segmentLabel: { es: 'Sonar {count}', en: 'Sonar {count}' },
  segmentAria: { es: 'Sonar, {count} en vivo', en: 'Sonar, {count} live' },
  popoverTitle: { es: 'Sonar', en: 'Sonar' },
  popoverSummary: { es: '{count} sirviendo', en: '{count} serving' },
  noWorktree: { es: 'Sin worktree', en: 'No worktree' },
  uptime: { es: 'Activo hace {time}', en: 'Up {time}' },
  memory: { es: 'RAM {size}', en: 'RAM {size}' },
  change: { es: 'cambiar', en: 'change' },
  changeAria: {
    es: 'Cambiar el worktree del puerto {port}',
    en: 'Change the worktree on port {port}'
  },
  noWorktrees: { es: 'Este proyecto no tiene worktrees', en: 'This project has no worktrees' },
  portOwner: { es: 'Lo ocupa', en: 'Held by' },
  freePort: { es: 'Detener ese proceso', en: 'Stop that process' },
  freePortTitle: {
    es: '¿Detener el proceso que ocupa :{port}?',
    en: 'Stop the process holding :{port}?'
  },
  freePortDescription: {
    es: 'Se enviará SIGTERM al proceso {pid} ({command}). Si dejó de ser el mismo proceso, no se toca.',
    en: 'SIGTERM will be sent to process {pid} ({command}). If it is no longer the same process, it is left alone.'
  },
  cancel: { es: 'Cancelar', en: 'Cancel' },
  externalNote: {
    es: 'La lista de puertos de Orca muestra estos puertos como externos, y el panel de memoria cuenta su RAM en el checkout principal.',
    en: "Orca's ports list shows these ports as external, and the memory dashboard counts their RAM on the primary checkout."
  },
  actionFailed: { es: 'No se pudo completar la acción', en: 'The action failed' },
  // Right sidebar panel
  panelUnsupported: {
    es: 'Sonar solo está disponible en macOS.',
    en: 'Sonar is only available on macOS.'
  },
  panelEmpty: {
    es: 'Ningún proyecto tiene puertos de Sonar. Configuralos en Ajustes → el proyecto → Sonar.',
    en: 'No project has Sonar ports. Set them up in Settings → the project → Sonar.'
  },
  sectionCount: { es: '{live}/{total}', en: '{live}/{total}' },
  sectionCountAria: {
    es: '{live} de {total} puertos en vivo',
    en: '{live} of {total} ports live'
  },
  worktreesTitle: { es: 'Worktrees', en: 'Worktrees' },
  serveOnSlot: { es: 'Poner en vivo en :{port} · {label}', en: 'Serve live on :{port} · {label}' },
  serveAnother: { es: 'Poner en vivo otro worktree…', en: 'Serve another worktree…' },
  dismissStandby: { es: 'Quitar de la lista', en: 'Remove from list' },
  showLogs: { es: 'Ver logs', en: 'Show logs' },
  hideLogs: { es: 'Ocultar logs', en: 'Hide logs' },
  logsEmpty: { es: 'Sin salida todavía.', en: 'No output yet.' },
  logsTruncated: {
    es: 'Mostrando las últimas {count} líneas.',
    en: 'Showing the last {count} lines.'
  },
  // Settings
  settingsDescription: {
    es: 'Puertos fijos que sirven un worktree de este proyecto a la vez. Cambiar de worktree no reinicia el servidor: se copian solo los archivos que difieren.',
    en: "Fixed ports that serve one of this project's worktrees at a time. Switching worktrees does not restart the server: only the files that differ are copied."
  },
  noSlots: {
    es: 'Este proyecto no tiene puertos configurados.',
    en: 'This project has no ports configured.'
  },
  slotLabel: { es: 'Nombre', en: 'Label' },
  slotId: { es: 'Id', en: 'Id' },
  slotPort: { es: 'Puerto', en: 'Port' },
  slotInstall: { es: 'Comando de instalación', en: 'Install command' },
  slotStart: { es: 'Comando de arranque', en: 'Start command' },
  slotDepsFiles: {
    es: 'Archivos de dependencias, separados por coma',
    en: 'Dependency files, comma-separated'
  },
  slotEnvFiles: { es: 'Archivos .env, separados por coma', en: '.env files, comma-separated' },
  addSlot: { es: 'Agregar puerto', en: 'Add port' },
  removeSlot: { es: 'Quitar puerto', en: 'Remove port' },
  save: { es: 'Guardar', en: 'Save' },
  reset: { es: 'Restablecer', en: 'Reset' },
  loadFailed: { es: 'No se pudo leer la configuración.', en: 'Could not read the configuration.' },
  // Config errors, keyed `<field>-<reason>`
  'id-required': { es: 'Falta el id.', en: 'The id is required.' },
  'id-invalid': {
    es: 'Id en minúsculas, números y guiones.',
    en: 'Lowercase id: letters, digits and dashes.'
  },
  'id-duplicate': { es: 'Ya hay un puerto con ese id.', en: 'Another port has this id.' },
  'label-required': { es: 'Falta el nombre.', en: 'The label is required.' },
  'port-invalid': { es: 'Puerto entre 1024 y 65535.', en: 'Port between 1024 and 65535.' },
  'port-duplicate': { es: 'Ya hay un puerto igual aquí.', en: 'Another port here uses it.' },
  'start-required': { es: 'Falta el comando de arranque.', en: 'The start command is required.' },
  'depsFiles-invalid': {
    es: 'Rutas relativas al repo, sin .. ni barra inicial.',
    en: 'Repo-relative paths, no .. or leading slash.'
  },
  'envFiles-invalid': {
    es: 'Rutas relativas al repo, sin .. ni barra inicial.',
    en: 'Repo-relative paths, no .. or leading slash.'
  },
  'config-invalid': { es: 'Configuración inválida.', en: 'Invalid configuration.' }
} as const

export type LiveLabelKey = keyof typeof LABELS

function uiLanguage(): string {
  // Tests that mock the i18n module with `translate` only throw on the instance.
  try {
    return rendererI18n.i18n.language ?? 'en'
  } catch {
    return 'en'
  }
}

/** The label in the UI language; `{name}` placeholders take the matching param. */
export function liveLabel(key: LiveLabelKey, params: Record<string, string | number> = {}): string {
  const pair = LABELS[key]
  const text = uiLanguage().startsWith('es') ? pair.es : pair.en
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  )
}

export function isLiveLabelKey(key: string): key is LiveLabelKey {
  return key in LABELS
}
