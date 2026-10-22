import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  createRestTestRig,
  restTestSend,
  type RestTestRig
} from '../../native-chat/agent-session-wire/structured-agent-session-rest-test-rig'
import {
  createTestParams,
  CREATE_TEST_CALLER as CALLER
} from '../../native-chat/agent-session-wire/structured-agent-session-create-test-fixture'
import {
  HOST_TEST_SESSION as SESSION,
  HOST_TEST_THREAD as THREAD,
  hostTestOperationId
} from '../../native-chat/agent-session-wire/structured-agent-session-host-test-data'
import type { AgentSessionAttachParams } from '../../native-chat/agent-session-wire/structured-agent-session-attach'
import { codexProviderHandle } from '../../../shared/agent-session-provider-handle-encoding'
import { markCachaloteCededChat, unmarkCachaloteCededChat } from './ceded-chats'

let rig: RestTestRig
beforeEach(async () => {
  rig = await createRestTestRig({ idleSweep: { intervalMs: 60_000 } })
})
afterEach(async () => {
  unmarkCachaloteCededChat(SESSION)
  await rig.dispose()
  vi.restoreAllMocks()
})

async function adoptedParams(): Promise<AgentSessionAttachParams> {
  const transcriptPath = join(rig.root, 'rollout.jsonl')
  await writeFile(
    transcriptPath,
    [
      JSON.stringify({
        type: 'session_meta',
        payload: { id: THREAD, timestamp: '2026-10-22T18:00:00.000Z', cwd: rig.root }
      }),
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-10-22T18:00:01.000Z',
        payload: { type: 'message', role: 'user', content: 'terminal history' }
      })
    ].join('\n')
  )
  return createTestParams(undefined, {
    adopt: { providerHandle: codexProviderHandle(THREAD), transcriptPath }
  })
}

function secondChat(params: AgentSessionAttachParams): AgentSessionAttachParams {
  return createTestParams(undefined, {
    ...params,
    envelope: {
      ...params.envelope,
      sessionId: 'session-second',
      clientOperationId: hostTestOperationId()
    }
  })
}

it('still refuses a second chat on a conversation a chat holds', async () => {
  const params = await adoptedParams()
  expect(await rig.host.create(CALLER, params)).toMatchObject({ ok: true })
  expect(await rig.host.create(CALLER, secondChat(params))).toMatchObject({
    ok: false,
    refusal: { code: 'agent_session_conflict', details: { reason: 'conversationHeldElsewhere' } }
  })
})

it('lets a new chat adopt a conversation the old chat ceded to a terminal', async () => {
  const params = await adoptedParams()
  expect(await rig.host.create(CALLER, params)).toMatchObject({ ok: true })
  markCachaloteCededChat(SESSION)
  expect(await rig.host.create(CALLER, secondChat(params))).toMatchObject({ ok: true })
  expect(rig.store.listRecords()).toHaveLength(2)
})

it('starts the agent of a chat that kept its conversation', async () => {
  expect(await rig.host.create(CALLER, await adoptedParams())).toMatchObject({ ok: true })
  await rig.host.send(CALLER, restTestSend('still the chat'))
  await vi.waitFor(() => expect(rig.adapter.acquire).toHaveBeenCalled())
})

it('never starts the agent of a chat that ceded its conversation', async () => {
  expect(await rig.host.create(CALLER, await adoptedParams())).toMatchObject({ ok: true })
  markCachaloteCededChat(SESSION)
  await rig.host.send(CALLER, restTestSend('after the handoff'))
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(rig.adapter.acquire).not.toHaveBeenCalled()
})
