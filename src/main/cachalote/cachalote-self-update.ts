import { dialog, Notification } from 'electron'
import { homedir } from 'node:os'
import path from 'node:path'
import { runProcess } from '../../shared/child-process/run-process'
import { mainI18n } from '../i18n/main-i18n'
import {
  hasCachaloteUpdate,
  parseInstalledBuildSha,
  parseSyncCheck,
  type CachaloteUpdateStatus
} from './cachalote-update-status'

// Same paths cachalote-sync (~/dotfiles/bin) hardcodes.
const REPO = path.join(homedir(), 'code/personal/cachalote')
const INSTALLED_PLIST = '/Applications/Cachalote.app/Contents/Info.plist'
const JOB = 'com.marcodelboccio.cachalote-self-update'
const LOG = path.join(homedir(), 'Library/Logs/cachalote-self-update.log')

const TEXT = {
  current: { es: 'Cachalote está al día', en: 'Cachalote is up to date' },
  available: { es: 'Hay una actualización de Cachalote', en: 'A Cachalote update is available' },
  running: { es: 'Ya hay una actualización en curso', en: 'An update is already running' },
  update: { es: 'Actualizar', en: 'Update' },
  cancel: { es: 'Cancelar', en: 'Cancel' },
  release: { es: 'Release nuevo de upstream', en: 'New upstream release' },
  pending: { es: 'Commits propios sin instalar', en: 'Own commits not installed' },
  checkFailed: {
    es: 'No se pudo consultar upstream; se instalarán solo los commits propios.',
    en: 'Could not reach upstream; only your own commits will be installed.'
  },
  warning: {
    es: 'El build corre en segundo plano (unos minutos). Al terminar, Cachalote se cierra y se vuelve a abrir: los agentes que estén corriendo en sus terminales se cortan.',
    en: 'The build runs in the background (a few minutes). When it finishes, Cachalote quits and reopens: agents running in its terminals are interrupted.'
  },
  started: {
    es: 'Build en segundo plano. Cachalote se reabre sola al terminar.',
    en: 'Building in the background. Cachalote reopens by itself when done.'
  },
  failed: { es: 'Falló la actualización de Cachalote', en: 'Cachalote update failed' },
  unreachable: {
    es: 'No se pudo consultar si hay un release nuevo de upstream.',
    en: 'Could not check upstream for a new release.'
  }
} as const

function text(key: keyof typeof TEXT): string {
  return mainI18n.language?.startsWith('es') ? TEXT[key].es : TEXT[key].en
}

// Login + interactive: fnm puts node on PATH from .zshrc, which a login-only shell skips.
function loginShell(command: string, timeoutMs: number | null) {
  return runProcess({ program: '/bin/zsh', args: ['-lic', command], timeoutMs })
}

async function readInstalledVersion(): Promise<string | null> {
  const result = await runProcess({
    program: '/usr/bin/plutil',
    args: ['-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', INSTALLED_PLIST],
    timeoutMs: 5_000
  })
  return result.code === 0 ? result.stdout.trim() || null : null
}

async function readPendingCommits(installedVersion: string | null): Promise<string[] | null> {
  const sha = parseInstalledBuildSha(installedVersion)
  if (!sha) {
    return null
  }
  const result = await runProcess({
    program: '/usr/bin/git',
    args: ['-C', REPO, 'log', '--format=%h %s', `${sha}..mine`],
    timeoutMs: 10_000
  })
  return result.code === 0 ? result.stdout.split('\n').filter((line) => line.length > 0) : null
}

async function readStatus(): Promise<CachaloteUpdateStatus> {
  const installedVersion = await readInstalledVersion()
  const [check, pendingCommits] = await Promise.all([
    loginShell('cachalote-sync --check', 60_000),
    readPendingCommits(installedVersion)
  ])
  return { installedVersion, upstream: parseSyncCheck(check.code, check.stdout), pendingCommits }
}

async function isUpdateRunning(): Promise<boolean> {
  const result = await runProcess({
    program: '/bin/launchctl',
    args: ['list', JOB],
    timeoutMs: 5_000
  })
  return result.code === 0
}

/**
 * Runs cachalote-sync as a launchd job: it must outlive this app, which the sync quits to swap
 * the bundle. A submitted job is kept alive, so it removes itself as its last step.
 */
async function startUpdate(): Promise<void> {
  const notifyFailure = `osascript -e 'display notification "${LOG}" with title "${text('failed')}"'`
  const script = [
    `echo "=== $(date) ==="`,
    `cachalote-sync || ${notifyFailure}`,
    `launchctl remove ${JOB}`
  ].join('; ')
  const result = await runProcess({
    program: '/bin/launchctl',
    args: ['submit', '-l', JOB, '-o', LOG, '-e', LOG, '--', '/bin/zsh', '-lic', script],
    timeoutMs: 10_000
  })
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `launchctl submit exited ${result.code}`)
  }
}

function describe(status: CachaloteUpdateStatus): string {
  const lines: string[] = []
  if (status.upstream.kind === 'new') {
    lines.push(`${text('release')}: ${status.upstream.tag}`)
  } else if (status.upstream.kind === 'error') {
    lines.push(text('checkFailed'))
  }
  if (status.pendingCommits && status.pendingCommits.length > 0) {
    lines.push(`${text('pending')}:`, ...status.pendingCommits.map((commit) => `  • ${commit}`))
  }
  return [...lines, '', text('warning')].join('\n')
}

async function checkAndOfferUpdate(): Promise<void> {
  if (await isUpdateRunning()) {
    await dialog.showMessageBox({ type: 'info', message: text('running'), detail: LOG })
    return
  }
  const status = await readStatus()
  if (!hasCachaloteUpdate(status)) {
    const unreachable = status.upstream.kind === 'error'
    await dialog.showMessageBox({
      type: unreachable ? 'warning' : 'info',
      message: unreachable ? text('unreachable') : text('current'),
      detail: unreachable ? 'cachalote-sync --check' : (status.installedVersion ?? '')
    })
    return
  }
  const { response } = await dialog.showMessageBox({
    type: 'question',
    message: text('available'),
    detail: describe(status),
    buttons: [text('update'), text('cancel')],
    defaultId: 0,
    cancelId: 1
  })
  if (response !== 0) {
    return
  }
  await startUpdate()
  new Notification({ title: text('available'), body: text('started') }).show()
}

/** Cachalote's "Check for Updates…": upstream's updater is off (see cachalote-flags.ts). */
export function runCachaloteUpdateCheck(): void {
  if (process.platform !== 'darwin') {
    return
  }
  checkAndOfferUpdate().catch((error: unknown) => {
    console.error('[cachalote] update check failed', error)
    dialog.showErrorBox(text('failed'), error instanceof Error ? error.message : String(error))
  })
}
