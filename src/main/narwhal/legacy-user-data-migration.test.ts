import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateLegacyUserDataFiles } from './legacy-user-data-migration'

let directory: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'narwhal-legacy-user-data-'))
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

describe('migrateLegacyUserDataFiles', () => {
  it('copies the legacy ceded-chats file when the new one is absent', () => {
    writeFileSync(join(directory, 'cachalote-ceded-chats.json'), '["chat-a"]')
    migrateLegacyUserDataFiles(directory)
    expect(existsSync(join(directory, 'cachalote-ceded-chats.json'))).toBe(true)
    expect(readFileSync(join(directory, 'narwhal-ceded-chats.json'), 'utf8')).toBe('["chat-a"]')
  })

  it('leaves both files untouched when the new one already exists', () => {
    writeFileSync(join(directory, 'cachalote-ceded-chats.json'), '["old"]')
    writeFileSync(join(directory, 'narwhal-ceded-chats.json'), '["new"]')
    migrateLegacyUserDataFiles(directory)
    expect(readFileSync(join(directory, 'cachalote-ceded-chats.json'), 'utf8')).toBe('["old"]')
    expect(readFileSync(join(directory, 'narwhal-ceded-chats.json'), 'utf8')).toBe('["new"]')
  })

  it('does nothing when no file exists', () => {
    migrateLegacyUserDataFiles(directory)
    expect(existsSync(join(directory, 'narwhal-ceded-chats.json'))).toBe(false)
  })

  it('does not throw when the user data directory is missing', () => {
    expect(() => migrateLegacyUserDataFiles(join(directory, 'missing'))).not.toThrow()
  })
})
