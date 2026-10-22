import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => tmpdir() }, ipcMain: { handle: vi.fn() } }))

import { agentSessionRecordFixture } from '../../native-chat/agent-session-record-test-fixture'
import { openTestAgentSessionRecordStore } from '../../runtime/agent-session-record-store-test-harness'
import { openTestJournalHostDatabase } from '../../native-chat/agent-session-journal/journal-host-database-test-support'
import { claudeAndCodexDeclared } from '../../native-chat/agent-session-wire/structured-agent-session-adapter-router-test-support'
import type { StructuredAgentSessionAdapter } from '../../native-chat/agent-session-wire/structured-agent-session-adapter'
import { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/structured-agent-session-host'
import { createStructuredAgentSessionLogger } from '../../native-chat/agent-session-wire/structured-agent-session-logger'
import { configureCachaloteCededChats, isCachaloteCededChat } from './ceded-chats'
import { cedeChatToTerminal } from './chat-to-terminal'

let directory: string
let host: StructuredAgentSessionHost

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'cachalote-chat-to-terminal-'))
  configureCachaloteCededChats(join(directory, 'ceded.json'))
  const adapter: StructuredAgentSessionAdapter = {
    open: vi.fn(async () => ({ reportedOptions: {} })),
    acquire: vi.fn(),
    dispatch: vi.fn(),
    closeSession: vi.fn(async () => true),
    cancelTurn: vi.fn(async () => ({ cancelled: false })),
    answerPrompt: vi.fn(async () => undefined),
    setOption: vi.fn(async () => undefined)
  }
  host = new StructuredAgentSessionHost({
    agents: claudeAndCodexDeclared(),
    logger: createStructuredAgentSessionLogger(),
    store: await openTestAgentSessionRecordStore(directory),
    adapter,
    journalDatabase: openTestJournalHostDatabase(directory),
    claimKeyId: 'key-1'
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(directory, { recursive: true, force: true })
})

describe('cedeChatToTerminal', () => {
  it('refuses a chat that no longer exists', async () => {
    await expect(cedeChatToTerminal(host, 'missing')).rejects.toThrow('no longer exists')
    await expect(cedeChatToTerminal(null, 'missing')).rejects.toThrow('no longer exists')
    expect(isCachaloteCededChat('missing')).toBe(false)
  })

  it('refuses a chat that is not Claude', async () => {
    const record = agentSessionRecordFixture({ sessionId: 'chat-codex', provider: 'codex' })
    vi.spyOn(host.deps.store, 'getRecord').mockReturnValue(record)
    const close = vi.spyOn(host, 'close')
    await expect(cedeChatToTerminal(host, record.sessionId)).rejects.toThrow('local Claude')
    expect(isCachaloteCededChat(record.sessionId)).toBe(false)
    expect(close).not.toHaveBeenCalled()
  })

  it('refuses a chat that is not local', async () => {
    const record = agentSessionRecordFixture({
      sessionId: 'chat-remote',
      location: { executionHostId: 'runtime:remote-env' }
    })
    vi.spyOn(host.deps.store, 'getRecord').mockReturnValue(record)
    const close = vi.spyOn(host, 'close')
    await expect(cedeChatToTerminal(host, record.sessionId)).rejects.toThrow('local Claude')
    expect(isCachaloteCededChat(record.sessionId)).toBe(false)
    expect(close).not.toHaveBeenCalled()
  })

  it('marks the chat ceded and closes it as a user close', async () => {
    const record = agentSessionRecordFixture({ sessionId: 'chat-ok' })
    vi.spyOn(host.deps.store, 'getRecord').mockReturnValue(record)
    const close = vi.spyOn(host, 'close').mockImplementation(async () => {
      // The mark must already stand while the close is in flight.
      expect(isCachaloteCededChat(record.sessionId)).toBe(true)
    })
    await cedeChatToTerminal(host, record.sessionId)
    expect(close).toHaveBeenCalledExactlyOnceWith(record.sessionId, 'user-close')
    expect(isCachaloteCededChat(record.sessionId)).toBe(true)
  })

  it('unmarks the chat and rethrows when the close fails', async () => {
    const record = agentSessionRecordFixture({ sessionId: 'chat-fail' })
    vi.spyOn(host.deps.store, 'getRecord').mockReturnValue(record)
    vi.spyOn(host, 'close').mockRejectedValue(new Error('exit not proven'))
    await expect(cedeChatToTerminal(host, record.sessionId)).rejects.toThrow('exit not proven')
    expect(isCachaloteCededChat(record.sessionId)).toBe(false)
  })
})
