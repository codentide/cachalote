import type { SonarSlotStatus } from '../../shared/rpc-contract/cachalote-sonar-params'

export function formatSonarStatus(
  slots: readonly SonarSlotStatus[],
  callerWorktreeId: string | null
): string {
  if (slots.length === 0) {
    return 'No Sonar ports configured.'
  }
  return slots
    .map((slot) => {
      const mine = callerWorktreeId !== null && slot.worktreeId === callerWorktreeId
      return [
        `:${slot.port}`,
        slot.label,
        slot.phase,
        slot.worktreePath ?? '-',
        slot.url,
        ...(mine ? ['(this worktree)'] : [])
      ].join('  ')
    })
    .join('\n')
}

export function formatSonarFailure(
  reason: 'crashed' | 'port-busy' | 'lost',
  slot: SonarSlotStatus | undefined,
  error: string | null,
  portOwner: SonarSlotStatus['portOwner']
): string {
  const port = slot ? `:${slot.port}` : 'The port'
  const head =
    reason === 'lost'
      ? `${port} no longer serves this worktree.`
      : reason === 'port-busy'
        ? `${port} is held by another process.`
        : `The server on ${port} crashed.`
  const lines = [head]
  if (error) {
    lines.push(error)
  }
  if (portOwner) {
    lines.push(
      `Port owner: pid ${portOwner.pid}, ${portOwner.command}${portOwner.cwd ? `, cwd ${portOwner.cwd}` : ''}`
    )
  }
  lines.push("Run 'orca sonar logs' to see the server output.")
  return lines.join('\n')
}
