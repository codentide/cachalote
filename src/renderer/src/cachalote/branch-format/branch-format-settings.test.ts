import { describe, expect, it } from 'vitest'
import {
  migrateStoredProjects,
  parseVariableRows,
  resolveProjectBranchFormat,
  undefinedTemplateVariables,
  variableRowsFrom,
  type ProjectBranchFormat,
  type VariableRow
} from './branch-format-settings'

const seed: ProjectBranchFormat = {
  template: '{type}/{task-id}',
  variables: { type: { kind: 'select', options: ['fix'] } }
}
const own: ProjectBranchFormat = { template: '{task-id}', variables: {} }

const select = (name: string, options: string): VariableRow => ({ name, kind: 'select', options })
const text = (name: string, options = ''): VariableRow => ({ name, kind: 'text', options })

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
  it('trims and dedupes the options of a select row', () => {
    expect(parseVariableRows([select(' type ', ' feat , fix,feat, ')])).toEqual({
      ok: true,
      variables: { type: { kind: 'select', options: ['feat', 'fix'] } }
    })
  })

  it('parses a text row and ignores its options', () => {
    expect(parseVariableRows([text('env', 'not, valid/options x')])).toEqual({
      ok: true,
      variables: { env: { kind: 'text' } }
    })
  })

  it('ignores fully empty rows', () => {
    expect(parseVariableRows([select('', ''), select(' ', ' , '), select('type', 'fix')])).toEqual({
      ok: true,
      variables: { type: { kind: 'select', options: ['fix'] } }
    })
  })

  it('flags the built-in task-id as reserved', () => {
    expect(parseVariableRows([select('task-id', 'a')])).toEqual({
      ok: false,
      errors: { 0: 'reserved-name' }
    })
  })

  it.each(['Country', '1x', 'my var'])('rejects the name %s', (name) => {
    expect(parseVariableRows([select(name, 'a')])).toEqual({
      ok: false,
      errors: { 0: 'invalid-name' }
    })
  })

  it('flags only the second occurrence of a name', () => {
    expect(parseVariableRows([select('type', 'a'), select('type', 'b')])).toEqual({
      ok: false,
      errors: { 1: 'duplicate-name' }
    })
  })

  it('flags a select with no options', () => {
    expect(parseVariableRows([select('type', ' , ')])).toEqual({
      ok: false,
      errors: { 0: 'missing-options' }
    })
  })

  it.each(['co, m x', 'feat/x'])('rejects the options %s', (options) => {
    expect(parseVariableRows([select('type', options)])).toEqual({
      ok: false,
      errors: { 0: 'invalid-option' }
    })
  })

  it('reports every bad row by index and is not ok', () => {
    const result = parseVariableRows([
      select('type', 'a'),
      select('Bad', 'a'),
      select('task-id', ''),
      select('scope', '')
    ])
    expect(result).toEqual({
      ok: false,
      errors: { 1: 'invalid-name', 2: 'reserved-name', 3: 'missing-options' }
    })
  })
})

describe('variableRowsFrom', () => {
  it('round-trips a select and a text variable through parseVariableRows', () => {
    const variables: ProjectBranchFormat['variables'] = {
      type: { kind: 'select', options: ['feature', 'fix'] },
      env: { kind: 'text' }
    }
    expect(parseVariableRows(variableRowsFrom(variables))).toEqual({ ok: true, variables })
  })
})

describe('undefinedTemplateVariables', () => {
  it('lists template variables missing from the project, never task-id', () => {
    expect(
      undefinedTemplateVariables('{type}/{env}/{task-id}', {
        type: { kind: 'select', options: ['fix'] }
      })
    ).toEqual(['env'])
  })

  it('is empty when every variable is defined', () => {
    expect(undefinedTemplateVariables('{type}/{task-id}', { type: { kind: 'text' } })).toEqual([])
  })
})

describe('migrateStoredProjects', () => {
  it('migrates a v1 entry to {var} placeholders and typed variables', () => {
    const persisted = {
      projects: {
        r1: {
          template: '{{type}}/{{task-id}}',
          variables: { type: ['feature', 'fix'], note: [] }
        }
      }
    }
    expect(migrateStoredProjects(persisted)).toEqual({
      r1: {
        template: '{type}/{task-id}',
        variables: {
          type: { kind: 'select', options: ['feature', 'fix'] },
          note: { kind: 'text' }
        }
      }
    })
  })

  it('keeps an entry that is already in the v2 shape', () => {
    const entry: ProjectBranchFormat = {
      template: '{type}/{env}/{task-id}',
      variables: { type: { kind: 'select', options: ['feat'] }, env: { kind: 'text' } }
    }
    expect(migrateStoredProjects({ projects: { r1: entry } })).toEqual({ r1: entry })
  })

  it('drops entries without a string template', () => {
    expect(
      migrateStoredProjects({
        projects: { bad: { variables: {} }, worse: { template: 3 }, nil: null }
      })
    ).toEqual({})
  })

  it.each([null, 'nope'])('returns {} for the non-object persisted value %s', (persisted) => {
    expect(migrateStoredProjects(persisted)).toEqual({})
  })
})
