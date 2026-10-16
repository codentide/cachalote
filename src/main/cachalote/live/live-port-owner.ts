import path from 'node:path'
import { runProcess } from '@orca/process-host'
import { LSOF_NONBLOCKING_ARGS } from '../../../shared/lsof-nonblocking-args'

/** Who holds a TCP port; cwd and command are what a kill is later checked against. */
export type PortOwner = { pid: number; command: string; cwd: string | null }
export type ProcessRow = { pid: number; ppid: number; rssKb: number }
export type SystemCommand = (program: string, args: string[]) => Promise<string>

const COMMAND_TIMEOUT_MS = 10_000
// Parents above the listener worth checking: pnpm -> next -> next-server is three deep.
const MAX_ANCESTOR_DEPTH = 8

/** lsof/ps exit non-zero when nothing matches; that is an empty answer, not a failure. */
export const runSystemCommand: SystemCommand = async (program, args) => {
  const result = await runProcess({ program, args, timeoutMs: COMMAND_TIMEOUT_MS })
  return result.stdout
}

export function parseLsofListeners(stdout: string): { pid: number; name: string }[] {
  const listeners: { pid: number; name: string }[] = []
  for (const line of stdout.split('\n')) {
    if (line.startsWith('p')) {
      const pid = Number.parseInt(line.slice(1), 10)
      if (Number.isSafeInteger(pid) && pid > 0) {
        listeners.push({ pid, name: '' })
      }
    } else if (line.startsWith('c') && listeners.length > 0) {
      const latest = listeners.at(-1)
      if (latest) {
        latest.name = line.slice(1)
      }
    }
  }
  return listeners
}

export function parseLsofCwds(stdout: string): Map<number, string> {
  const cwds = new Map<number, string>()
  let current: number | null = null
  for (const line of stdout.split('\n')) {
    if (line.startsWith('p')) {
      const pid = Number.parseInt(line.slice(1), 10)
      current = Number.isSafeInteger(pid) ? pid : null
    } else if (line.startsWith('n') && current !== null && line.length > 1) {
      cwds.set(current, line.slice(1))
    }
  }
  return cwds
}

export function parseProcessTable(stdout: string): ProcessRow[] {
  const rows: ProcessRow[] = []
  for (const line of stdout.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s*$/.exec(line)
    if (match) {
      rows.push({ pid: Number(match[1]), ppid: Number(match[2]), rssKb: Number(match[3]) })
    }
  }
  return rows
}

/** Sum of resident memory of `rootPid` and every descendant, in bytes. */
export function subtreeRssBytes(rows: readonly ProcessRow[], rootPid: number): number {
  const children = new Map<number, ProcessRow[]>()
  for (const row of rows) {
    const siblings = children.get(row.ppid)
    if (siblings) {
      siblings.push(row)
    } else {
      children.set(row.ppid, [row])
    }
  }
  const byPid = new Map(rows.map((row) => [row.pid, row]))
  const seen = new Set<number>()
  const stack = [rootPid]
  let totalKb = 0
  while (stack.length > 0) {
    const pid = stack.pop()
    if (pid === undefined || seen.has(pid)) {
      continue
    }
    seen.add(pid)
    totalKb += byPid.get(pid)?.rssKb ?? 0
    for (const child of children.get(pid) ?? []) {
      stack.push(child.pid)
    }
  }
  return totalKb * 1024
}

/** True when `candidate` is `directory` or lives under it. */
export function isInsideDirectory(
  directory: string,
  candidate: string | null | undefined
): boolean {
  return Boolean(
    candidate && (candidate === directory || candidate.startsWith(directory + path.sep))
  )
}

export class PortInspector {
  constructor(private readonly run: SystemCommand = runSystemCommand) {}

  async listeners(port: number): Promise<{ pid: number; name: string }[]> {
    const stdout = await this.run('lsof', [
      ...LSOF_NONBLOCKING_ARGS,
      '-nP',
      `-iTCP:${port}`,
      '-sTCP:LISTEN',
      '-Fpcn'
    ])
    return parseLsofListeners(stdout)
  }

  async cwdsOf(pids: readonly number[]): Promise<Map<number, string>> {
    if (pids.length === 0) {
      return new Map()
    }
    const stdout = await this.run('lsof', [
      ...LSOF_NONBLOCKING_ARGS,
      '-a',
      '-p',
      pids.join(','),
      '-d',
      'cwd',
      '-Fn'
    ])
    return parseLsofCwds(stdout)
  }

  private async commandOf(pid: number): Promise<string | null> {
    const stdout = await this.run('ps', ['-p', String(pid), '-o', 'command='])
    return stdout.trim() || null
  }

  /** The process listening on `port`, or null when nothing does. */
  async resolveOwner(port: number): Promise<PortOwner | null> {
    const [first] = await this.listeners(port)
    if (!first) {
      return null
    }
    const [cwds, command] = await Promise.all([this.cwdsOf([first.pid]), this.commandOf(first.pid)])
    return { pid: first.pid, command: command ?? first.name, cwd: cwds.get(first.pid) ?? null }
  }

  /** RSS of the process tree behind the listener; null when the listener is not ours. */
  async treeRssBytes(port: number, runnerPath: string): Promise<number | null> {
    const [first] = await this.listeners(port)
    if (!first) {
      return null
    }
    const rows = parseProcessTable(await this.run('ps', ['-axo', 'pid=,ppid=,rss=']))
    const parentOf = new Map(rows.map((row) => [row.pid, row.ppid]))
    const chain = [first.pid]
    for (let depth = 0; depth < MAX_ANCESTOR_DEPTH; depth += 1) {
      const parent = parentOf.get(chain.at(-1) ?? first.pid)
      if (!parent || parent <= 1) {
        break
      }
      chain.push(parent)
    }
    const cwds = await this.cwdsOf(chain)
    if (!isInsideDirectory(runnerPath, cwds.get(first.pid))) {
      return null
    }
    // The PTY shell and the package-manager wrapper start in the runner too, so the tree's root is
    // the highest ancestor that still is.
    let top = first.pid
    for (const ancestor of chain.slice(1)) {
      if (!isInsideDirectory(runnerPath, cwds.get(ancestor))) {
        break
      }
      top = ancestor
    }
    return subtreeRssBytes(rows, top)
  }
}

/** SIGTERM that treats an already-gone pid as success; refuses Cachalote's own process. */
export function terminateProcess(
  pid: number,
  kill: (pid: number, signal: NodeJS.Signals) => void = process.kill.bind(process)
): void {
  if (!Number.isSafeInteger(pid) || pid <= 1 || pid === process.pid) {
    throw new Error('Refusing to stop that process.')
  }
  try {
    kill(pid, 'SIGTERM')
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) {
      throw error
    }
  }
}
