import { defineMethod } from '../../runtime/rpc/core'
import {
  SONAR_DEFAULT_LOG_LINES,
  SonarLogs,
  SonarServe,
  SonarStop,
  type SonarServeResult,
  type SonarStatusResult,
  type SonarStopResult
} from '../../../shared/rpc-contract/cachalote-sonar-params'
import { sonarConflict } from '../../../shared/cachalote/live/sonar-cli-policy'
import { requireLiveEngine } from './live-engine-ref'
import { worktreePathForRepo } from './live-project-model'

const IDLE_SLOT = { worktreeId: null, phase: 'idle' } as const

export const SONAR_METHODS = [
  defineMethod({
    name: 'sonar.status',
    permission: 'workspace',
    params: null,
    handler: (): SonarStatusResult => {
      const snapshot = requireLiveEngine().snapshot()
      return {
        supported: snapshot.supported,
        slots: snapshot.slots.map((slot) => ({
          repoId: slot.repoId,
          slotId: slot.slotId,
          label: slot.label,
          port: slot.port,
          phase: slot.phase,
          worktreeId: slot.worktreeId,
          startedAt: slot.startedAt,
          error: slot.error,
          portOwner: slot.portOwner,
          url: `http://localhost:${slot.port}`,
          worktreePath: slot.worktreeId ? worktreePathForRepo(slot.repoId, slot.worktreeId) : null
        }))
      }
    }
  }),
  defineMethod({
    name: 'sonar.serve',
    permission: 'workspace',
    params: SonarServe,
    handler: async (params): Promise<SonarServeResult> => {
      const engine = requireLiveEngine()
      const state = engine
        .snapshot()
        .slots.find((slot) => slot.repoId === params.repoId && slot.slotId === params.slotId)
      const busy = sonarConflict(state ?? IDLE_SLOT, params.worktreeId, params.force === true)
      if (busy) {
        return busy
      }
      await engine.project({
        repoId: params.repoId,
        slotId: params.slotId,
        worktreeId: params.worktreeId
      })
      return { status: 'requested' }
    }
  }),
  defineMethod({
    name: 'sonar.stop',
    permission: 'workspace',
    params: SonarStop,
    handler: async (params): Promise<SonarStopResult> => {
      const engine = requireLiveEngine()
      const state = engine
        .snapshot()
        .slots.find((slot) => slot.repoId === params.repoId && slot.slotId === params.slotId)
      const busy = sonarConflict(
        state ?? IDLE_SLOT,
        params.worktreeId ?? null,
        params.force === true
      )
      if (busy) {
        return busy
      }
      await engine.stop({ repoId: params.repoId, slotId: params.slotId })
      return { status: 'stopped' }
    }
  }),
  defineMethod({
    name: 'sonar.logs',
    permission: 'workspace',
    params: SonarLogs,
    handler: (params) =>
      requireLiveEngine().readLogs(
        { repoId: params.repoId, slotId: params.slotId },
        params.limit ?? SONAR_DEFAULT_LOG_LINES
      )
  })
]
