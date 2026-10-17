import type {
  SonarBusy,
  SonarLogsResult,
  SonarServeResult,
  SonarSlotStatus,
  SonarStatusResult,
  SonarStopResult
} from '../../shared/rpc-contract/cachalote-sonar-params'
import { SONAR_DEFAULT_LOG_LINES } from '../../shared/rpc-contract/cachalote-sonar-params'
import {
  pickSonarSlot,
  sonarServeProgress,
  type SonarSlotChoice
} from '../../shared/cachalote/live/sonar-cli-policy'
import type { RuntimeWorktreeRecord } from '../../shared/runtime-worktree-contracts'
import type { CommandHandler, HandlerContext } from '../dispatch'
import {
  getOptionalNonNegativeIntegerFlag,
  getOptionalPositiveIntegerFlag,
  getOptionalStringFlag
} from '../flags'
import { RuntimeClientError } from '../runtime-client'
import { getOptionalWorktreeSelector, resolveCurrentWorktreeSelector } from '../selectors'
import { formatSonarFailure, formatSonarStatus } from './sonar-format'

const DEFAULT_SERVE_TIMEOUT_MS = 300_000
const POLL_INTERVAL_MS = 1000

type Caller = { worktreeId: string; repoId: string; path: string }

async function callSonar<T>(
  client: HandlerContext['client'],
  method: 'sonar.status' | 'sonar.serve' | 'sonar.stop' | 'sonar.logs',
  params?: unknown
): Promise<T> {
  try {
    return (await client.call<T>(method, params)).result
  } catch (error) {
    if (error instanceof RuntimeClientError && error.code === 'method_not_found') {
      throw new RuntimeClientError(
        'incompatible_runtime',
        'This Orca build has no Sonar; update Cachalote.'
      )
    }
    throw error
  }
}

async function readStatus(client: HandlerContext['client']): Promise<SonarStatusResult> {
  const status = await callSonar<SonarStatusResult>(client, 'sonar.status')
  if (!status.supported) {
    throw new RuntimeClientError('unsupported', 'Sonar is only available on macOS.')
  }
  return status
}

async function showCaller({ client }: HandlerContext, selector: string): Promise<Caller> {
  const { result } = await client.call<{ worktree: RuntimeWorktreeRecord }>('worktree.show', {
    worktree: selector
  })
  const { id, repoId, path } = result.worktree
  return { worktreeId: id, repoId, path }
}

async function resolveCaller(context: HandlerContext): Promise<Caller> {
  const { flags, client, cwd } = context
  const selector =
    (await getOptionalWorktreeSelector(flags, 'worktree', cwd, client)) ??
    (await resolveCurrentWorktreeSelector(cwd, client))
  return showCaller(context, selector)
}

function emit(context: HandlerContext, result: object, text: string): void {
  if (context.json) {
    console.log(JSON.stringify({ result }, null, 2))
  } else {
    console.log(text)
  }
}

function pickOrThrow(
  slots: readonly SonarSlotStatus[],
  caller: Caller,
  context: HandlerContext,
  preferServing: boolean
): SonarSlotStatus {
  const choice: SonarSlotChoice = pickSonarSlot(slots, {
    repoId: caller.repoId,
    worktreeId: caller.worktreeId,
    port: getOptionalPositiveIntegerFlag(context.flags, 'port'),
    slotId: getOptionalStringFlag(context.flags, 'slot'),
    preferServing
  })
  if (choice.ok) {
    return choice.slot
  }
  const ports = choice.ports.join(', ')
  const message =
    choice.reason === 'no-slots'
      ? 'This project has no Sonar ports. Add one in Settings > the project > Sonar.'
      : choice.reason === 'ambiguous'
        ? `This project has several Sonar ports (${ports}): pass --port.`
        : `No Sonar port matches; this project has ${ports}.`
  throw new RuntimeClientError('invalid_argument', message)
}

function reportBusy(
  context: HandlerContext,
  slot: SonarSlotStatus,
  slots: readonly SonarSlotStatus[],
  busy: SonarBusy
): void {
  const holder =
    slots.find((s) => s.worktreeId === busy.worktreeId)?.worktreePath ?? busy.worktreeId
  emit(
    context,
    { status: 'busy', slot, busy },
    `:${slot.port} is serving ${holder} (${busy.phase}). Pass --force to take it.`
  )
  process.exitCode = 1
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const SONAR_HANDLERS: Record<string, CommandHandler> = {
  'sonar status': async (context) => {
    const { flags, client } = context
    let caller: Caller | null = null
    const explicit = getOptionalStringFlag(flags, 'worktree')
    try {
      caller = await resolveCaller(context)
    } catch (error) {
      // Outside any worktree there is no project to scope to, so fall back to every slot.
      if (
        explicit ||
        !(error instanceof RuntimeClientError && error.code === 'selector_not_found')
      ) {
        throw error
      }
    }
    const result = await readStatus(client)
    const showAll = flags.get('all') === true || caller === null
    const slots = showAll
      ? result.slots
      : result.slots.filter((slot) => slot.repoId === caller?.repoId)
    const callerWorktreeId = caller?.worktreeId ?? null
    emit(
      context,
      { ...result, slots, callerWorktreeId },
      formatSonarStatus(slots, callerWorktreeId)
    )
  },

  'sonar serve': async (context) => {
    const { flags, client } = context
    const caller = await resolveCaller(context)
    const status = await readStatus(client)
    const slot = pickOrThrow(status.slots, caller, context, false)
    const served = await callSonar<SonarServeResult>(client, 'sonar.serve', {
      repoId: caller.repoId,
      slotId: slot.slotId,
      worktreeId: caller.worktreeId,
      force: flags.get('force') === true ? true : undefined
    })
    if (served.status === 'busy') {
      reportBusy(context, slot, status.slots, served)
      return
    }
    const target = `:${slot.port}`
    const timeoutMs = getOptionalNonNegativeIntegerFlag(flags, 'timeout-ms')
    const budget = timeoutMs ?? DEFAULT_SERVE_TIMEOUT_MS
    if (budget === 0) {
      emit(context, { status: 'requested', slot }, `Requested ${target} for ${caller.path}.`)
      return
    }
    const deadline = Date.now() + budget
    for (;;) {
      const current = (await callSonar<SonarStatusResult>(client, 'sonar.status')).slots.find(
        (s) => s.repoId === caller.repoId && s.slotId === slot.slotId
      )
      const progress = sonarServeProgress(current, caller.worktreeId)
      if (progress.kind === 'live' && current) {
        emit(
          context,
          { status: 'live', slot: current },
          `Live: ${current.url} (${current.worktreePath ?? caller.worktreeId})`
        )
        return
      }
      if (progress.kind === 'failed') {
        emit(
          context,
          {
            status: 'failed',
            reason: progress.reason,
            slot: current ?? slot,
            error: progress.error,
            portOwner: progress.portOwner
          },
          formatSonarFailure(progress.reason, current ?? slot, progress.error, progress.portOwner)
        )
        process.exitCode = 1
        return
      }
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        const phase = current?.phase ?? slot.phase
        emit(
          context,
          { status: 'timeout', slot: current ?? slot, phase },
          `Still ${phase} after ${Math.round(budget / 1000)}s. Run 'orca sonar logs' to see the server output.`
        )
        process.exitCode = 1
        return
      }
      await sleep(Math.min(POLL_INTERVAL_MS, remaining))
    }
  },

  'sonar logs': async (context) => {
    const { flags, client } = context
    const caller = await resolveCaller(context)
    const status = await readStatus(client)
    const slot = pickOrThrow(status.slots, caller, context, true)
    const logs = await callSonar<SonarLogsResult>(client, 'sonar.logs', {
      repoId: caller.repoId,
      slotId: slot.slotId,
      limit: getOptionalPositiveIntegerFlag(flags, 'limit') ?? SONAR_DEFAULT_LOG_LINES
    })
    emit(
      context,
      { ...logs, slot },
      logs.lines.length > 0 ? logs.lines.join('\n') : `No server output for :${slot.port}.`
    )
  },

  'sonar stop': async (context) => {
    const { flags, client } = context
    const caller = await resolveCaller(context)
    const status = await readStatus(client)
    const slot = pickOrThrow(status.slots, caller, context, true)
    const stopped = await callSonar<SonarStopResult>(client, 'sonar.stop', {
      repoId: caller.repoId,
      slotId: slot.slotId,
      worktreeId: caller.worktreeId,
      force: flags.get('force') === true ? true : undefined
    })
    if (stopped.status === 'busy') {
      reportBusy(context, slot, status.slots, stopped)
      return
    }
    emit(context, { status: 'stopped', slot }, `Stopped :${slot.port}.`)
  }
}
