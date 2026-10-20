// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CachaloteUpdateState } from '../../../../shared/cachalote/cachalote-update-state'
import { CachaloteUpdateCard } from './CachaloteUpdateCard'

let push: (state: CachaloteUpdateState) => void = () => {}

beforeEach(() => {
  Object.assign(window, {
    api: {
      updater: {
        onCachaloteState: (listener: (state: CachaloteUpdateState) => void) => {
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

describe('CachaloteUpdateCard updated state', () => {
  it('lists what the sync resolved and what stays pending, then dismisses', () => {
    render(<CachaloteUpdateCard />)
    act(() =>
      push({
        kind: 'updated',
        release: 'v1.4.233',
        reappliedFiles: ['src/renderer/src/components/sidebar/WorktreeList.tsx'],
        resolvedFiles: ['src/renderer/src/components/native-chat/NativeChatToolRun.tsx'],
        pendingTestFiles: ['src/main/cachalote/live/live-watch.test.ts']
      })
    )
    expect(screen.getByText(/v1\.4\.233/)).toBeTruthy()
    expect(screen.getByText('NativeChatToolRun.tsx')).toBeTruthy()
    expect(screen.getByText('WorktreeList.tsx').getAttribute('title')).toBe(
      'src/renderer/src/components/sidebar/WorktreeList.tsx'
    )
    expect(screen.getByText('live-watch.test.ts')).toBeTruthy()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText(/v1\.4\.233/)).toBeNull()
  })

  it('omits the pending list when every test still typechecks', () => {
    render(<CachaloteUpdateCard />)
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
