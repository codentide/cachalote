import { getFreshShellForegroundSnapshot } from '../../../shared/process-table-snapshot-reader'
import { collectDescendantsFromIndex, getProcessTableIndex } from '../../../shared/process-table-index'
import { isShellProcess } from '../../../shared/agent-status/process/shell-process-detection'
import { MACOS_LOGIN_PATH } from '../../providers/macos-tcc-login-shell'

/**
 * Whether the pane's shell sits alone at its prompt: no foreground job and no session leader below it.
 * Kept here since upstream (v1.4.255) dropped the process-table census it used to run itself.
 */
export async function posixShellAlone(rootPid: number): Promise<boolean> {
  const index = getProcessTableIndex(await getFreshShellForegroundSnapshot())
  const executable = (command: string) => command.trim().replace(/^-/, '').split(/\s+/, 1)[0] ?? ''
  const root = index.byPid.get(rootPid)
  // macOS panes spawn under login(1), which stays as the shell's parent; it is launch plumbing.
  const launched =
    root && executable(root.command) === MACOS_LOGIN_PATH
      ? (index.childrenByPpid.get(rootPid) ?? [])
      : undefined
  const shell = launched ? (launched.length === 1 ? launched[0] : undefined) : root
  return (
    !!shell &&
    isShellProcess(executable(shell.command)) &&
    shell.stat.includes('+') &&
    // A session leader below the shell has left this terminal (a prompt's zpty worker); its jobs never do.
    collectDescendantsFromIndex(index, shell.pid, (row) => row.stat.includes('s')).length === 0
  )
}
