import { useCallback } from 'react'
import type React from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import {
  openWorkspacePortInBrowser,
  resolvePortOpenInOrcaBrowser
} from '@/lib/workspace-port-actions'
import { useWorktreeRuntimeTarget } from '@/runtime/use-worktree-runtime-target'
import type { WorkspacePort } from '../../../../shared/workspace-ports'

/** Opens a slot's port the way Orca opens any localhost port, in the tab of the worktree it serves. */
export function useOpenLivePort(
  worktreeId: string | null
): (port: number, event?: React.MouseEvent) => void {
  const settings = useAppStore((s) => s.settings)
  const createBrowserTab = useAppStore((s) => s.createBrowserTab)
  const setRemoteBrowserPageHandle = useAppStore((s) => s.setRemoteBrowserPageHandle)
  const runtimeTarget = useWorktreeRuntimeTarget(worktreeId)

  return useCallback(
    (port, event) => {
      // Not attributed to a worktree by Orca's scanner, so it goes in as an external port.
      const target: WorkspacePort = {
        kind: 'external',
        id: `live:${port}`,
        bindHost: '127.0.0.1',
        connectHost: '127.0.0.1',
        port,
        protocol: 'http'
      }
      void openWorkspacePortInBrowser({
        port: target,
        activeWorktreeId: worktreeId,
        runtimeTarget,
        createBrowserTab,
        setRemoteBrowserPageHandle,
        openInOrcaBrowser: resolvePortOpenInOrcaBrowser({
          settings,
          // Keyboard activations carry no modifier intent.
          event: event && event.detail > 0 ? event.nativeEvent : null,
          isMac: navigator.userAgent.includes('Mac')
        })
      }).then((result) => {
        if (!result.ok) {
          toast.error(result.reason)
        }
      })
    },
    [createBrowserTab, runtimeTarget, setRemoteBrowserPageHandle, settings, worktreeId]
  )
}
