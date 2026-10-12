import { BrowserWindow, ipcMain } from 'electron'
import { homedir } from 'node:os'
import path from 'node:path'
import { runProcess } from '../../shared/child-process/run-process'
import {
  CACHALOTE_UPDATE_START_CHANNEL,
  CACHALOTE_UPDATE_STATE_CHANNEL,
  type CachaloteUpdateState
} from '../../shared/cachalote/cachalote-update-state'
import {
  backgroundUpdateKey,
  parseInstalledBuildSha,
  parseSyncCheck,
  toCachaloteUpdateState,
  type CachaloteUpdateStatus
} from './cachalote-update-status'

// Same paths cachalote-sync (~/dotfiles/bin) hardcodes.
const REPO = path.join(homedir(), 'code/personal/cachalote')
const INSTALLED_PLIST = '/Applications/Cachalote.app/Contents/Info.plist'
const JOB = 'com.marcodelboccio.cachalote-self-update'
const LOG = path.join(homedir(), 'Library/Logs/cachalote-self-update.log')
// Leaves startup alone, then follows roughly the cadence of upstream's own update checks.
const BACKGROUND_FIRST_CHECK_MS = 60_000
const BACKGROUND_INTERVAL_MS = 6 * 60 * 60_000

// The card lives in the main window; popouts simply ignore the channel.
function publish(state: CachaloteUpdateState): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(CACHALOTE_UPDATE_STATE_CHANNEL, state)
    }
  }
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
 * the bundle. A submitted job is kept alive, so it removes itself as its last step. The app may
 * already be gone when a build fails, so failure is reported with a system notification.
 */
async function startUpdate(): Promise<void> {
  const notifyFailure = `osascript -e 'display notification "${LOG}" with title "Cachalote update failed"'`
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

async function checkForUpdate(): Promise<void> {
  publish({ kind: 'checking' })
  if (await isUpdateRunning()) {
    publish({ kind: 'running' })
    return
  }
  publish(toCachaloteUpdateState(await readStatus()))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Cachalote's "Check for Updates…": upstream's updater is off (see cachalote-flags.ts). */
export function runCachaloteUpdateCheck(): void {
  if (process.platform !== 'darwin') {
    return
  }
  checkForUpdate().catch((error: unknown) => {
    console.error('[cachalote] update check failed', error)
    publish({ kind: 'failed', message: errorMessage(error) })
  })
}

let backgroundChecksStarted = false
// The last update surfaced unprompted: a dismissed card stays dismissed until something changes.
let lastBackgroundKey: string | null = null

async function backgroundCheck(): Promise<void> {
  if (await isUpdateRunning()) {
    return
  }
  const state = toCachaloteUpdateState(await readStatus())
  const key = backgroundUpdateKey(state)
  if (key && key !== lastBackgroundKey) {
    lastBackgroundKey = key
    publish(state)
  }
}

/** Silent periodic checks in the installed app; the card appears only for a new upstream release. */
export function startCachaloteBackgroundChecks(): void {
  if (backgroundChecksStarted || process.platform !== 'darwin') {
    return
  }
  backgroundChecksStarted = true
  const run = (): void => {
    backgroundCheck().catch((error: unknown) => {
      console.warn('[cachalote] background update check failed', error)
    })
  }
  setTimeout(run, BACKGROUND_FIRST_CHECK_MS).unref()
  setInterval(run, BACKGROUND_INTERVAL_MS).unref()
}

/** The card's Update button; re-registered with the rest of the updater IPC. */
export function registerCachaloteUpdateHandlers(): void {
  ipcMain.removeHandler(CACHALOTE_UPDATE_START_CHANNEL)
  ipcMain.handle(CACHALOTE_UPDATE_START_CHANNEL, async () => {
    try {
      await startUpdate()
      publish({ kind: 'started' })
    } catch (error) {
      publish({ kind: 'failed', message: errorMessage(error) })
    }
  })
}
