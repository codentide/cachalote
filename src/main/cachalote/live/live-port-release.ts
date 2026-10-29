import type { LiveSlot } from './live-slot'
import type { PortOwner } from './live-port-owner'
import type { LiveServerDeps } from './live-server-contract'

const PORT_RELEASE_WAIT_MS = 3_000
const PORT_RELEASE_POLL_MS = 250

export type PortReleaseContext = {
  find: (port: number, pid: number) => { slot: LiveSlot; owner: PortOwner } | null
  resolveOwner: (port: number) => Promise<PortOwner | null>
  server: Pick<LiveServerDeps, 'probe' | 'sleep' | 'terminate'>
}

/**
 * Stops a foreign listener, but only the exact process the slot reported: the holder is looked up
 * again right before the signal and must still match pid, cwd and command.
 */
export async function freeForeignPort(
  args: { port: number; pid: number },
  context: PortReleaseContext
): Promise<void> {
  if (args.pid === process.pid) {
    throw new Error('Cachalot cannot stop its own process.')
  }
  const reported = context.find(args.port, args.pid)
  if (!reported) {
    throw new Error('That port is not reported as busy.')
  }
  const current = await context.resolveOwner(args.port)
  if (current) {
    const { owner } = reported
    if (
      current.pid !== owner.pid ||
      current.cwd !== owner.cwd ||
      current.command !== owner.command
    ) {
      throw new Error('The process holding the port changed; check it again.')
    }
    context.server.terminate(current.pid)
  }
  reported.slot.server.clearPortBusy()
  if (reported.slot.worktreeId) {
    void restartAfterRelease(reported.slot, args.port, context.server)
  }
}

async function restartAfterRelease(
  slot: LiveSlot,
  port: number,
  server: Pick<LiveServerDeps, 'probe' | 'sleep'>
): Promise<void> {
  for (let waited = 0; waited < PORT_RELEASE_WAIT_MS; waited += PORT_RELEASE_POLL_MS) {
    if (!(await server.probe(port))) {
      break
    }
    await server.sleep(PORT_RELEASE_POLL_MS)
  }
  await slot.requestServerStart().catch(() => undefined)
}
