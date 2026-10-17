import { describe, expect, it } from 'vitest'
import { normalizeRightSidebarTab } from '../../persistence/applying-settings/ui-selection-normalization'

describe('Sonar right sidebar tab', () => {
  it('is kept when persisted UI state is loaded', () => {
    expect(normalizeRightSidebarTab('sonar')).toBe('sonar')
  })
})
