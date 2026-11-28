import { ipcRenderer } from 'electron'
import type { UpdateStatus } from '../../../shared/updater/update-status-types'
import { prepareAndInvokeUpdaterInstall } from '../../renderer/restart/renderer-restart-wiring'
import { awaitBeforeUnloadCheckpoint, updaterQuitAbortRelay } from '../../renderer/renderer-runtime'
import type { PreloadApi } from '../../api-types'
// Narwhal: update card channels.
import {
  NARWHAL_UPDATE_START_CHANNEL,
  NARWHAL_UPDATE_STATE_CHANNEL,
  type NarwhalUpdateState
} from '../../../shared/narwhal/narwhal-update-state'

export const updaterApi = {
  getStatus: () => ipcRenderer.invoke('updater:getStatus'),
  getVersion: () => ipcRenderer.invoke('updater:getVersion'),
  check: (options) => ipcRenderer.invoke('updater:check', options),
  download: () => ipcRenderer.invoke('updater:download'),
  dismissNudge: () => ipcRenderer.invoke('updater:dismissNudge'),
  dismissAvailableUpdate: () => ipcRenderer.invoke('updater:dismissAvailableUpdate'),
  snoozeRequiredUpdate: () => ipcRenderer.invoke('updater:snoozeRequiredUpdate'),
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
  // Narwhal: update bridge
  narwhalStart: () => ipcRenderer.invoke(NARWHAL_UPDATE_START_CHANNEL),
  onNarwhalState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: NarwhalUpdateState) =>
      callback(state)
    ipcRenderer.on(NARWHAL_UPDATE_STATE_CHANNEL, listener)
    return () => ipcRenderer.removeListener(NARWHAL_UPDATE_STATE_CHANNEL, listener)
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
