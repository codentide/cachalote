import { ipcRenderer } from 'electron'
import type { UpdateStatus } from '../../shared/update-status-types'
import { prepareAndInvokeUpdaterInstall } from '../renderer-restart-wiring'
import { awaitBeforeUnloadCheckpoint, updaterQuitAbortRelay } from '../preload-runtime-support'
import type { PreloadApi } from '../api-types'
// Cachalote: update card channels.
import {
  CACHALOTE_UPDATE_START_CHANNEL,
  CACHALOTE_UPDATE_STATE_CHANNEL,
  type CachaloteUpdateState
} from '../../shared/cachalote/cachalote-update-state'

export const updaterApi = {
  getStatus: () => ipcRenderer.invoke('updater:getStatus'),
  getVersion: () => ipcRenderer.invoke('updater:getVersion'),
  check: (options) => ipcRenderer.invoke('updater:check', options),
  download: () => ipcRenderer.invoke('updater:download'),
  dismissNudge: () => ipcRenderer.invoke('updater:dismissNudge'),
  dismissAvailableUpdate: () => ipcRenderer.invoke('updater:dismissAvailableUpdate'),
  getLinuxPackageInstallInstructions: () =>
    ipcRenderer.invoke('updater:getLinuxPackageInstallInstructions'),
  showLinuxPackage: () => ipcRenderer.invoke('updater:showLinuxPackage'),
  listBuilds: (channel, options) => ipcRenderer.invoke('updater:listBuilds', channel, options),
  quitAndInstall: (): Promise<void> =>
    prepareAndInvokeUpdaterInstall(
      window,
      updaterQuitAbortRelay,
      () => ipcRenderer.invoke('updater:quitAndInstall'),
      awaitBeforeUnloadCheckpoint
    ),

  // Cachalote
  cachaloteStart: () => ipcRenderer.invoke(CACHALOTE_UPDATE_START_CHANNEL),
  onCachaloteState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: CachaloteUpdateState) =>
      callback(state)
    ipcRenderer.on(CACHALOTE_UPDATE_STATE_CHANNEL, listener)
    return () => ipcRenderer.removeListener(CACHALOTE_UPDATE_STATE_CHANNEL, listener)
  },

  onStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => callback(status)
    ipcRenderer.on('updater:status', listener)
    return () => ipcRenderer.removeListener('updater:status', listener)
  },
  onClearDismissal: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on('updater:clearDismissal', listener)
    return () => ipcRenderer.removeListener('updater:clearDismissal', listener)
  }
} satisfies PreloadApi['updater']
