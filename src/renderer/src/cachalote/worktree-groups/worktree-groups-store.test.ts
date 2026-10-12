import { beforeEach, describe, expect, it } from 'vitest'
import { WORKTREE_GROUP_COLOR_ROTATION, useWorktreeGroupsStore } from './worktree-groups-store'

beforeEach(() => {
  useWorktreeGroupsStore.setState({
    groups: {},
    membership: {},
    collapsed: {},
    nameRequest: null
  })
})

describe('worktree groups store', () => {
  it('creates a group around the given worktrees', () => {
    const id = useWorktreeGroupsStore.getState().createGroup('  Checkout  ', ['app', 'backend'])
    const state = useWorktreeGroupsStore.getState()
    expect(state.groups[id]).toEqual({
      id,
      name: 'Checkout',
      color: WORKTREE_GROUP_COLOR_ROTATION[0]
    })
    expect(state.membership).toEqual({ app: id, backend: id })
  })

  it('moves a worktree from one group to another and drops the emptied group', () => {
    const store = useWorktreeGroupsStore.getState()
    const first = store.createGroup('First', ['app'])
    const second = store.createGroup('Second', ['backend'])
    useWorktreeGroupsStore.getState().addToGroup(second, ['app'])
    const state = useWorktreeGroupsStore.getState()
    expect(state.membership).toEqual({ app: second, backend: second })
    expect(state.groups[first]).toBeUndefined()
  })

  it('drops a group and its collapse state once its last member leaves', () => {
    const id = useWorktreeGroupsStore.getState().createGroup('Solo', ['app'])
    useWorktreeGroupsStore.getState().toggleCollapsed(id)
    useWorktreeGroupsStore.getState().removeFromGroup(['app'])
    const state = useWorktreeGroupsStore.getState()
    expect(state.groups).toEqual({})
    expect(state.collapsed).toEqual({})
  })

  it('ignores adding to a group that does not exist', () => {
    useWorktreeGroupsStore.getState().addToGroup('missing', ['app'])
    expect(useWorktreeGroupsStore.getState().membership).toEqual({})
  })

  it('keeps the old name when a rename is blank', () => {
    const id = useWorktreeGroupsStore.getState().createGroup('Checkout', ['app'])
    useWorktreeGroupsStore.getState().renameGroup(id, '   ')
    expect(useWorktreeGroupsStore.getState().groups[id]?.name).toBe('Checkout')
  })

  it('gives each new group the next color in the rotation', () => {
    const store = useWorktreeGroupsStore.getState()
    const first = store.createGroup('First', ['app'])
    const second = useWorktreeGroupsStore.getState().createGroup('Second', ['backend'])
    const { groups } = useWorktreeGroupsStore.getState()
    expect(groups[first]?.color).toBe(WORKTREE_GROUP_COLOR_ROTATION[0])
    expect(groups[second]?.color).toBe(WORKTREE_GROUP_COLOR_ROTATION[1])
  })

  it('changes a group color and ignores unknown groups', () => {
    const id = useWorktreeGroupsStore.getState().createGroup('Checkout', ['app'])
    useWorktreeGroupsStore.getState().setGroupColor(id, 'rose')
    useWorktreeGroupsStore.getState().setGroupColor('missing', 'rose')
    const { groups } = useWorktreeGroupsStore.getState()
    expect(groups[id]?.color).toBe('rose')
    expect(groups.missing).toBeUndefined()
  })
})
