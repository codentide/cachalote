import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { agentSessionConversationView } from '../../../shared/agent-session/lifecycle/leases/agent-session-conversation-view'
import { agentSessionRecordFixture } from '../../../shared/agent-session/lifecycle/records/agent-session-record.test-fixture'
import { listStructuredProviderSessionOwnership } from '../../native-chat/agent-session-wire/host/structured-provider-session-ownership'
import {
  configureNarwhalCededChats,
  isNarwhalCededChat,
  markNarwhalCededChat,
  unmarkNarwhalCededChat
} from './ceded-chats'

let directory: string
let file: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'narwhal-ceded-chats-'))
  file = join(directory, 'nested', 'ceded.json')
  configureNarwhalCededChats(file)
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('ceded chats set', () => {
  it('marks, queries and unmarks a chat', () => {
    expect(isNarwhalCededChat('chat-a')).toBe(false)
    markNarwhalCededChat('chat-a')
    expect(isNarwhalCededChat('chat-a')).toBe(true)
    expect(isNarwhalCededChat('chat-b')).toBe(false)
    unmarkNarwhalCededChat('chat-a')
    expect(isNarwhalCededChat('chat-a')).toBe(false)
  })

  it('survives a reload from the same file', () => {
    markNarwhalCededChat('chat-a')
    markNarwhalCededChat('chat-b')
    unmarkNarwhalCededChat('chat-b')
    configureNarwhalCededChats(file)
    expect(isNarwhalCededChat('chat-a')).toBe(true)
    expect(isNarwhalCededChat('chat-b')).toBe(false)
  })

  it('starts empty when the file is missing', () => {
    expect(isNarwhalCededChat('chat-a')).toBe(false)
  })
})

describe('provider session ownership', () => {
  it('leaves out a chat that ceded its conversation', () => {
    const kept = agentSessionConversationView(agentSessionRecordFixture())
    const ceded = agentSessionConversationView({
      ...agentSessionRecordFixture(),
      sessionId: 'session-ceded'
    })
    markNarwhalCededChat(ceded.sessionId)
    const owners = listStructuredProviderSessionOwnership([kept, ceded])
    expect(owners.map((owner) => owner.sessionId)).toEqual([kept.sessionId])
  })

  it('lists the chat again once it is unmarked', () => {
    const record = agentSessionConversationView(agentSessionRecordFixture())
    markNarwhalCededChat(record.sessionId)
    expect(listStructuredProviderSessionOwnership([record])).toEqual([])
    unmarkNarwhalCededChat(record.sessionId)
    expect(listStructuredProviderSessionOwnership([record])).toHaveLength(1)
  })
})
