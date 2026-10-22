import { LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import { isRemoteRuntimePtyId } from '../../../shared/remote-runtime/remote-runtime-pty-id'
import { parseAppSshPtyId } from '../../providers/ssh-pty-id'
import { ptyOwnership } from '../../ipc/pty/provider/ownership-state'
import { getProviderForPty, hasPtyProviderForInspection } from '../../ipc/pty/provider/registry'
import { posixCliWriterShellAlone } from '../../runtime/structured-agent-cli-writers'

/**
 * The census chat adoption runs on a local POSIX pane, so a caller can wait for it instead of
 * racing the prompt hooks a shell runs right after the agent exits. Null: not readable here.
 */
export async function cachaloteTerminalShellAlone(ptyId: string): Promise<boolean | null> {
  if (
    process.platform === 'win32' ||
    isRemoteRuntimePtyId(ptyId) ||
    parseAppSshPtyId(ptyId) ||
    (ptyOwnership.get(ptyId) ?? LOCAL_EXECUTION_HOST_ID) !== LOCAL_EXECUTION_HOST_ID ||
    !hasPtyProviderForInspection(ptyId)
  ) {
    return null
  }
  const session = (await getProviderForPty(ptyId).listProcesses()).find(
    (candidate) => candidate.id === ptyId
  )
  if (session?.rootProcessId === undefined || session.wslDistro) {
    return null
  }
  return posixCliWriterShellAlone(session.rootProcessId)
}
