import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyComposerWorktreeGroup,
  bindComposerWorktreeGroup,
  useComposerWorktreeGroupStore
} from './composer-worktree-group'
import { useWorktreeGroupsStore } from './worktree-groups-store'

beforeEach(() => {
  useWorktreeGroupsStore.setState({ groups: {}, membership: {}, collapsed: {}, nameRequest: null })
  useComposerWorktreeGroupStore.setState({ choice: { kind: 'none' } })
})

describe('composer worktree group', () => {
  it('leaves a worktree ungrouped when the composer picked no group', () => {
    bindComposerWorktreeGroup('creation-1')
    applyComposerWorktreeGroup('creation-1', 'app')
    expect(useWorktreeGroupsStore.getState().membership).toEqual({})
  })

  it('files the worktree under the existing group picked at submit time', () => {
    const groupId = useWorktreeGroupsStore.getState().createGroup('AX-3227', ['backend'])
    useComposerWorktreeGroupStore.getState().setChoice({ kind: 'existing', groupId })
    bindComposerWorktreeGroup('creation-1')
    // The composer closes, and resets, before the worktree exists.
    useComposerWorktreeGroupStore.getState().setChoice({ kind: 'none' })
    applyComposerWorktreeGroup('creation-1', 'app')
    expect(useWorktreeGroupsStore.getState().membership).toEqual({
      backend: groupId,
      app: groupId
    })
  })

  it('creates the new group once the first worktree exists', () => {
    useComposerWorktreeGroupStore
      .getState()
      .setChoice({ kind: 'new', name: 'AX-3492', token: 'token-1' })
    bindComposerWorktreeGroup('creation-1')
    expect(useWorktreeGroupsStore.getState().groups).toEqual({})
    applyComposerWorktreeGroup('creation-1', 'app')
    const { groups, membership } = useWorktreeGroupsStore.getState()
    const [group] = Object.values(groups)
    expect(group?.name).toBe('AX-3492')
    expect(membership).toEqual({ app: group?.id })
  })

  it('sends every creation queued under one new-group choice to the same group', () => {
    useComposerWorktreeGroupStore
      .getState()
      .setChoice({ kind: 'new', name: 'AX-3492', token: 'token-1' })
    bindComposerWorktreeGroup('creation-1')
    bindComposerWorktreeGroup('creation-2')
    applyComposerWorktreeGroup('creation-2', 'backend')
    applyComposerWorktreeGroup('creation-1', 'app')
    const { groups, membership } = useWorktreeGroupsStore.getState()
    expect(Object.keys(groups)).toHaveLength(1)
    expect(membership.app).toBe(membership.backend)
  })

  it('switches a still-open composer to the group it just made', () => {
    useComposerWorktreeGroupStore
      .getState()
      .setChoice({ kind: 'new', name: 'AX-3492', token: 'token-1' })
    bindComposerWorktreeGroup('creation-1')
    applyComposerWorktreeGroup('creation-1', 'app')
    const groupId = useWorktreeGroupsStore.getState().membership.app
    expect(useComposerWorktreeGroupStore.getState().choice).toEqual({ kind: 'existing', groupId })
  })

  it('applies a bound creation only once', () => {
    const groupId = useWorktreeGroupsStore.getState().createGroup('AX-3227', ['backend'])
    useComposerWorktreeGroupStore.getState().setChoice({ kind: 'existing', groupId })
    bindComposerWorktreeGroup('creation-1')
    applyComposerWorktreeGroup('creation-1', 'app')
    useWorktreeGroupsStore.getState().removeFromGroup(['app'])
    applyComposerWorktreeGroup('creation-1', 'app')
    expect(useWorktreeGroupsStore.getState().membership).toEqual({ backend: groupId })
  })
})
