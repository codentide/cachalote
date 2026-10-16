import { ipcRenderer } from 'electron'
import {
  CACHALOTE_LIVE_CHANNELS,
  type CachaloteLiveApi
} from '../../shared/cachalote/live/live-ipc'
import type { LiveSnapshot } from '../../shared/cachalote/live/live-types'

export const cachaloteLiveApi = {
  getConfig: (repoId) => ipcRenderer.invoke(CACHALOTE_LIVE_CHANNELS.getConfig, repoId),
  saveConfig: (config) => ipcRenderer.invoke(CACHALOTE_LIVE_CHANNELS.saveConfig, config),
  resetConfig: (repoId) => ipcRenderer.invoke(CACHALOTE_LIVE_CHANNELS.resetConfig, repoId),
  project: (args) => ipcRenderer.invoke(CACHALOTE_LIVE_CHANNELS.project, args),
  stop: (args) => ipcRenderer.invoke(CACHALOTE_LIVE_CHANNELS.stop, args),
  snapshot: () => ipcRenderer.invoke(CACHALOTE_LIVE_CHANNELS.snapshot),
  usage: (args) => ipcRenderer.invoke(CACHALOTE_LIVE_CHANNELS.usage, args),
  focusTerminal: (args) => ipcRenderer.invoke(CACHALOTE_LIVE_CHANNELS.focusTerminal, args),
  freePort: (args) => ipcRenderer.invoke(CACHALOTE_LIVE_CHANNELS.freePort, args),
  onChanged: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: LiveSnapshot): void =>
      listener(snapshot)
    ipcRenderer.on(CACHALOTE_LIVE_CHANNELS.changed, handler)
    return () => ipcRenderer.removeListener(CACHALOTE_LIVE_CHANNELS.changed, handler)
  }
} satisfies CachaloteLiveApi
