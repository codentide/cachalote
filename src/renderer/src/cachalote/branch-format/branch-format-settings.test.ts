import { describe, expect, it } from 'vitest'
import {
  parseVariableRows,
  resolveProjectBranchFormat,
  undefinedTemplateVariables,
  variableRowsFrom,
  type ProjectBranchFormat
} from './branch-format-settings'

const seed: ProjectBranchFormat = { template: '{{type}}/{{task-id}}', variables: { type: ['fix'] } }
const own: ProjectBranchFormat = { template: '{{task-id}}', variables: {} }

describe('resolveProjectBranchFormat', () => {
  const resolve = (
    projects: Record<string, ProjectBranchFormat>,
    displayName: string | null = 'ax-app'
  ) =>
    resolveProjectBranchFormat({ repoId: 'r1', displayName, projects, seeds: { 'ax-app': seed } })

  it('prefers the saved entry over the seed', () => {
    expect(resolve({ r1: own })).toBe(own)
  })

  it('falls back to the seed by display name', () => {
    expect(resolve({})).toBe(seed)
  })

  it('treats an empty or whitespace-only template as off', () => {
    expect(resolve({ r1: { template: '', variables: {} } })).toBeNull()
    expect(resolve({ r1: { template: '  ', variables: {} } })).toBeNull()
  })

  it('is null with no saved entry and no seed', () => {
    expect(resolve({}, 'other')).toBeNull()
  })

  it('is null for a null display name with no saved entry', () => {
    expect(resolve({}, null)).toBeNull()
  })
})

describe('parseVariableRows', () => {
  it('trims and dedupes options', () => {
    expect(parseVariableRows([{ name: ' type ', options: ' feat , fix,feat, ' }])).toEqual({
      ok: true,
      variables: { type: ['feat', 'fix'] }
    })
  })

  it('ignores fully empty rows', () => {
    expect(
      parseVariableRows([
        { name: '', options: '' },
        { name: ' ', options: ' , ' },
        { name: 'type', options: 'fix' }
      ])
    ).toEqual({ ok: true, variables: { type: ['fix'] } })
  })

  it('accepts a variable with no options', () => {
    expect(parseVariableRows([{ name: 'scope', options: '' }])).toEqual({
      ok: true,
      variables: { scope: [] }
    })
  })

  it('flags the built-in task-id as reserved', () => {
    expect(parseVariableRows([{ name: 'task-id', options: 'a' }])).toEqual({
      ok: false,
      errors: { 0: 'reserved-name' }
    })
  })

  it.each(['Country', '1x', 'my var'])('rejects the name %s', (name) => {
    expect(parseVariableRows([{ name, options: 'a' }])).toEqual({
      ok: false,
      errors: { 0: 'invalid-name' }
    })
  })

  it('flags only the second occurrence of a name', () => {
    expect(
      parseVariableRows([
        { name: 'type', options: 'a' },
        { name: 'type', options: 'b' }
      ])
    ).toEqual({ ok: false, errors: { 1: 'duplicate-name' } })
  })

  it.each(['co, m x', 'feat/x'])('rejects the options %s', (options) => {
    expect(parseVariableRows([{ name: 'type', options }])).toEqual({
      ok: false,
      errors: { 0: 'invalid-option' }
    })
  })

  it('reports every bad row by index and is not ok', () => {
    const result = parseVariableRows([
      { name: 'type', options: 'a' },
      { name: 'Bad', options: 'a' },
      { name: 'task-id', options: '' }
    ])
    expect(result).toEqual({ ok: false, errors: { 1: 'invalid-name', 2: 'reserved-name' } })
  })
})

describe('variableRowsFrom', () => {
  it('round-trips through parseVariableRows', () => {
    const variables = { type: ['feature', 'fix'], country: ['co', 'mx'], scope: [] }
    expect(parseVariableRows(variableRowsFrom(variables))).toEqual({ ok: true, variables })
  })
})

describe('undefinedTemplateVariables', () => {
  it('lists template variables missing from the project, never task-id', () => {
    expect(
      undefinedTemplateVariables('{{type}}/{{country}}/{{task-id}}', { type: ['fix'] })
    ).toEqual(['country'])
  })

  it('is empty when every variable is defined', () => {
    expect(undefinedTemplateVariables('{{type}}/{{task-id}}', { type: [] })).toEqual([])
  })
})
