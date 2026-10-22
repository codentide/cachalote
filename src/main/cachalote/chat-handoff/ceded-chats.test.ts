import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { agentSessionConversationView } from '../../../shared/agent-session-conversation-view'
import { agentSessionRecordFixture } from '../../../shared/agent-session-record.test-fixture'
import { listStructuredProviderSessionOwnership } from '../../native-chat/agent-session-wire/structured-provider-session-ownership'
import {
  configureCachaloteCededChats,
  isCachaloteCededChat,
  markCachaloteCededChat,
  unmarkCachaloteCededChat
} from './ceded-chats'

let directory: string
let file: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'cachalote-ceded-chats-'))
  file = join(directory, 'nested', 'ceded.json')
  configureCachaloteCededChats(file)
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('ceded chats set', () => {
  it('marks, queries and unmarks a chat', () => {
    expect(isCachaloteCededChat('chat-a')).toBe(false)
    markCachaloteCededChat('chat-a')
    expect(isCachaloteCededChat('chat-a')).toBe(true)
    expect(isCachaloteCededChat('chat-b')).toBe(false)
    unmarkCachaloteCededChat('chat-a')
    expect(isCachaloteCededChat('chat-a')).toBe(false)
  })

  it('survives a reload from the same file', () => {
    markCachaloteCededChat('chat-a')
    markCachaloteCededChat('chat-b')
    unmarkCachaloteCededChat('chat-b')
    configureCachaloteCededChats(file)
    expect(isCachaloteCededChat('chat-a')).toBe(true)
    expect(isCachaloteCededChat('chat-b')).toBe(false)
  })

  it('starts empty when the file is missing', () => {
    expect(isCachaloteCededChat('chat-a')).toBe(false)
  })
})

describe('provider session ownership', () => {
  it('leaves out a chat that ceded its conversation', () => {
    const kept = agentSessionConversationView(agentSessionRecordFixture())
    const ceded = agentSessionConversationView({
      ...agentSessionRecordFixture(),
      sessionId: 'session-ceded'
    })
    markCachaloteCededChat(ceded.sessionId)
    const owners = listStructuredProviderSessionOwnership([kept, ceded])
    expect(owners.map((owner) => owner.sessionId)).toEqual([kept.sessionId])
  })

  it('lists the chat again once it is unmarked', () => {
    const record = agentSessionConversationView(agentSessionRecordFixture())
    markCachaloteCededChat(record.sessionId)
    expect(listStructuredProviderSessionOwnership([record])).toEqual([])
    unmarkCachaloteCededChat(record.sessionId)
    expect(listStructuredProviderSessionOwnership([record])).toHaveLength(1)
  })
})
