import { describe, expect, it } from 'vitest'
import {
  extractTaskId,
  renderBranchName,
  templatePlaceholders,
  templateVariables,
  toBranchSegment
} from './branch-format'

describe('extractTaskId', () => {
  it.each([
    ['AX-3203', 'AX-3203'],
    ['ax 3203', 'AX-3203'],
    ['ax_3203 descuentos', 'AX-3203'],
    ['fix banner AX-3492', 'AX-3492'],
    ['SUP-1761', 'SUP-1761']
  ])('reads %s as %s', (name, expected) => {
    expect(extractTaskId(name)).toBe(expected)
  })

  it.each(['BACKEND-Auxiliar-2', 'Claude-Chore', 'landing_col', ''])(
    'finds no task id in %s',
    (name) => {
      expect(extractTaskId(name)).toBeNull()
    }
  )
})

describe('templateVariables', () => {
  it('lists the variables in order, once, without the task id', () => {
    expect(templateVariables('{type}/{country}/{task-id}-{type}')).toEqual(['type', 'country'])
  })
})

describe('renderBranchName', () => {
  const render = (template: string, name: string, values: Record<string, string> = {}) =>
    renderBranchName({ template, name, values })

  it('builds each repo convention from the same task id', () => {
    expect(render('{task-id}', 'ax 3203')).toBe('AX-3203')
    expect(render('{type}/{task-id}', 'AX-3203', { type: 'feature' })).toBe('feature/AX-3203')
    expect(render('{type}/{country}/{task-id}', 'AX-3203', { type: 'fix', country: 'co' })).toBe(
      'fix/co/AX-3203'
    )
  })

  it('falls back to the name as a slug when it has no task id', () => {
    expect(render('{type}/{task-id}', 'Sidebar pins and announcements', { type: 'chore' })).toBe(
      'chore/sidebar-pins-and-announcements'
    )
  })

  it('drops the segment of an empty variable', () => {
    expect(render('{type}/{country}/{task-id}', 'AX-3203', { type: 'feature' })).toBe(
      'feature/AX-3203'
    )
  })

  it('turns spaces in a free-text value into dashes', () => {
    expect(render('{type}/{task-id}-{note}', 'AX-3203', { type: 'fix', note: ' new date ' })).toBe(
      'fix/AX-3203-new-date'
    )
  })

  it('gives no branch for an empty name', () => {
    expect(render('{type}/{task-id}', '   ', { type: 'feature' })).toBeNull()
  })
})

describe('templatePlaceholders', () => {
  it('lists every placeholder in order, the task id included', () => {
    expect(templatePlaceholders('{type}/{task-id}-{type}')).toEqual(['type', 'task-id'])
  })

  it('leaves the old double-brace syntax for the migration', () => {
    expect(templatePlaceholders('{{type}}')).toEqual(['type'])
  })
})

describe('toBranchSegment', () => {
  it.each([
    [' new date ', 'new-date'],
    ['a/b', 'a-b'],
    ['what?*:~^', 'what'],
    ['..hidden..', 'hidden'],
    ['--x--', 'x']
  ])('turns %j into %j', (value, expected) => {
    expect(toBranchSegment(value)).toBe(expected)
  })
})

describe('renderBranchName with a typed task id', () => {
  it('prefers the typed task id over the name', () => {
    expect(
      renderBranchName({
        template: '{type}/{task-id}',
        name: 'AX-1111 old title',
        values: { type: 'fix' },
        taskId: 'ax 3203'
      })
    ).toBe('fix/AX-3203')
  })

  it('keeps a typed id that is not a task key as a branch segment', () => {
    expect(
      renderBranchName({ template: '{task-id}', name: '', values: {}, taskId: 'hotfix banner' })
    ).toBe('hotfix-banner')
  })

  it('falls back to the name when the task id is left empty', () => {
    expect(
      renderBranchName({ template: '{task-id}', name: 'ax_3203', values: {}, taskId: '  ' })
    ).toBe('AX-3203')
  })
})
