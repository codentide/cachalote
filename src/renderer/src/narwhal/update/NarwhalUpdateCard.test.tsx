// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { NarwhalUpdateState } from '../../../../shared/narwhal/narwhal-update-state'
import { NarwhalUpdateCard } from './NarwhalUpdateCard'

let push: (state: NarwhalUpdateState) => void = () => {}

beforeEach(() => {
  Object.assign(window, {
    api: {
      updater: {
        onNarwhalState: (listener: (state: NarwhalUpdateState) => void) => {
          push = listener
          return () => {}
        }
      }
    }
  })
})

afterEach(() => {
  cleanup()
})

describe('NarwhalUpdateCard updated state', () => {
  it('lists what the sync resolved and what stays pending, then dismisses', () => {
    render(<NarwhalUpdateCard />)
    act(() =>
      push({
        kind: 'updated',
        release: 'v1.4.233',
        reappliedFiles: ['src/renderer/src/components/sidebar/WorktreeList.tsx'],
        resolvedFiles: ['src/renderer/src/components/native-chat/NativeChatToolRun.tsx'],
        pendingTestFiles: ['src/main/narwhal/chat-handoff/ceded-chats.test.ts']
      })
    )
    expect(screen.getByText(/v1\.4\.233/)).toBeTruthy()
    expect(screen.getByText('NativeChatToolRun.tsx')).toBeTruthy()
    expect(screen.getByText('WorktreeList.tsx').getAttribute('title')).toBe(
      'src/renderer/src/components/sidebar/WorktreeList.tsx'
    )
    expect(screen.getByText('ceded-chats.test.ts')).toBeTruthy()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText(/v1\.4\.233/)).toBeNull()
  })

  it('omits the pending list when every test still typechecks', () => {
    render(<NarwhalUpdateCard />)
    act(() =>
      push({
        kind: 'updated',
        release: null,
        reappliedFiles: ['src/a.ts'],
        resolvedFiles: [],
        pendingTestFiles: []
      })
    )
    expect(screen.getByText('a.ts')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})
