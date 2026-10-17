import { describe, expect, it } from 'vitest'
import { normalizeRightSidebarRoute } from '../../store/right-sidebar-route'

describe('Sonar right sidebar tab', () => {
  it('survives hydration instead of falling back to the explorer', () => {
    expect(normalizeRightSidebarRoute('sonar')).toEqual({
      rightSidebarTab: 'sonar',
      rightSidebarExplorerView: 'files'
    })
  })
})
