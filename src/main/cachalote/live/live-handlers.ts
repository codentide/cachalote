import { app, BrowserWindow, ipcMain } from 'electron'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { CACHALOTE_LIVE_CHANNELS } from '../../../shared/cachalote/live/live-ipc'
import type { LiveSnapshot } from '../../../shared/cachalote/live/live-types'
import type { Store } from '../../persistence'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { LiveConfigStore } from './live-config-store'
import { LiveEngine } from './live-engine'
import { setLiveEngine } from './live-engine-ref'
import { isFreePortArgs, isLiveProjectConfig, isProjectArgs, isSlotRef } from './live-input-guards'
import { PortInspector, terminateProcess } from './live-port-owner'
import { recoverLiveSlots } from './live-recovery'
import { watchWorktree } from './live-watch'

const PROBE_TIMEOUT_MS = 800

function connects(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    const finish = (open: boolean): void => {
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(PROBE_TIMEOUT_MS)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

/** Dev servers bind either loopback family (Vite and Node 17+ resolve `localhost` to ::1). */
async function probePort(port: number): Promise<boolean> {
  return (await connects('127.0.0.1', port)) || (await connects('::1', port))
}

function broadcast(snapshot: LiveSnapshot): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(CACHALOTE_LIVE_CHANNELS.changed, snapshot)
    }
  }
}

function invalidArguments(channel: string): Error {
  return new Error(`${channel}: invalid arguments`)
}

/**
 * Registers Sonar inside upstream's core handler registration; a Sonar failure is logged and never
 * stops the handlers registered after it.
 */
export function registerCachaloteLiveHandlers(store: Store, runtime: OrcaRuntimeService): void {
  try {
    registerLiveHandlers(store, runtime)
  } catch (error) {
    console.error(
      '[cachalote-live] Sonar could not start; the rest of the app keeps running',
      error
    )
  }
}

/** IPC for Sonar, plus the deferred recovery of slots that were live before a restart. */
function registerLiveHandlers(store: Store, runtime: OrcaRuntimeService): void {
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
  const inspector = new PortInspector()
  const config = new LiveConfigStore(path.join(app.getPath('userData'), 'cachalote-live.json'))
  const engine = new LiveEngine({
    getRepos: () => store.getRepos(),
    config,
    slotDeps: {
      server: {
        runtime,
        probe: probePort,
        resolveOwner: (port) => inspector.resolveOwner(port),
        terminate: terminateProcess,
        now: () => Date.now(),
        sleep
      },
      watch: watchWorktree
    },
    inspector,
    platform: process.platform,
    homeDir: os.homedir(),
    emit: broadcast
  })

  // Cachalote: Sonar CLI
  setLiveEngine(engine)

  const channels = CACHALOTE_LIVE_CHANNELS
  for (const channel of Object.values(channels)) {
    ipcMain.removeHandler(channel)
  }
  ipcMain.handle(channels.getConfig, (_event, repoId: unknown) => {
    if (typeof repoId !== 'string') {
      throw invalidArguments(channels.getConfig)
    }
    return engine.getConfig(repoId)
  })
  ipcMain.handle(channels.saveConfig, (_event, input: unknown) => {
    if (!isLiveProjectConfig(input)) {
      throw invalidArguments(channels.saveConfig)
    }
    return engine.saveConfig(input)
  })
  ipcMain.handle(channels.resetConfig, (_event, repoId: unknown) => {
    if (typeof repoId !== 'string') {
      throw invalidArguments(channels.resetConfig)
    }
    return engine.resetConfig(repoId)
  })
  ipcMain.handle(channels.project, (_event, input: unknown) => {
    if (!isProjectArgs(input)) {
      throw invalidArguments(channels.project)
    }
    return engine.project(input)
  })
  ipcMain.handle(channels.stop, (_event, input: unknown) => {
    if (!isSlotRef(input)) {
      throw invalidArguments(channels.stop)
    }
    return engine.stop(input)
  })
  ipcMain.handle(channels.snapshot, () => engine.snapshot())
  ipcMain.handle(channels.usage, (_event, input: unknown) => {
    if (!isSlotRef(input)) {
      throw invalidArguments(channels.usage)
    }
    return engine.usage(input)
  })
  ipcMain.handle(channels.focusTerminal, (_event, input: unknown) => {
    if (!isSlotRef(input)) {
      throw invalidArguments(channels.focusTerminal)
    }
    return engine.focusTerminal(input)
  })
  ipcMain.handle(channels.freePort, (_event, input: unknown) => {
    if (!isFreePortArgs(input)) {
      throw invalidArguments(channels.freePort)
    }
    return engine.freePort(input)
  })

  app.once('will-quit', () => {
    config.flushSync()
    setLiveEngine(null)
    engine.dispose()
  })
  void recoverLiveSlots(engine.adoptPersistedSlots(), runtime, sleep).then(() => engine.notify())
}
