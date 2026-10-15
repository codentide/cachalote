import type { SettingsSearchEntry } from '../../components/settings/settings-search'
import { TASK_ID_VARIABLE, templateVariables } from './branch-format'

/** A select offers fixed options in the composer; a text variable is typed per worktree. */
export type VariableSpec = { kind: 'select'; options: readonly string[] } | { kind: 'text' }
export type VariableKind = VariableSpec['kind']

/** A project's branch format: its template and the variables it offers. */
export type ProjectBranchFormat = {
  /** '' turns the format off for the project. */
  template: string
  variables: Readonly<Record<string, VariableSpec>>
}

/** One editable row of the settings section; options are comma-separated and only used by selects. */
export type VariableRow = { name: string; kind: VariableKind; options: string }

export type VariableRowError =
  | 'invalid-name'
  | 'duplicate-name'
  | 'reserved-name'
  | 'invalid-option'
  | 'missing-options'

export type ParsedVariableRows =
  | { ok: true; variables: Record<string, VariableSpec> }
  | { ok: false; errors: Record<number, VariableRowError> }

const VARIABLE_NAME = /^[a-z][a-z0-9-]*$/
// One branch path segment: no spaces, slashes or characters git rejects in ref names.
const VARIABLE_OPTION = /^[a-z0-9][a-z0-9._-]*$/i

/** The saved format for a project, else its seed by sidebar name; null when it has none or it is off. */
export function resolveProjectBranchFormat(args: {
  repoId: string
  displayName: string | null
  projects: Readonly<Record<string, ProjectBranchFormat>>
  seeds: Readonly<Record<string, ProjectBranchFormat>>
}): ProjectBranchFormat | null {
  const format =
    args.projects[args.repoId] ?? (args.displayName ? args.seeds[args.displayName] : undefined)
  return format && format.template.trim() ? format : null
}

/** Rows for the settings editor, in the format's own order. */
export function variableRowsFrom(variables: ProjectBranchFormat['variables']): VariableRow[] {
  return Object.entries(variables).map(([name, spec]) => ({
    name,
    kind: spec.kind,
    options: spec.kind === 'select' ? spec.options.join(', ') : ''
  }))
}

/** Validates the editor rows; rows with neither a name nor options are ignored. */
export function parseVariableRows(rows: readonly VariableRow[]): ParsedVariableRows {
  const variables: Record<string, VariableSpec> = {}
  const errors: Record<number, VariableRowError> = {}
  rows.forEach((row, index) => {
    const name = row.name.trim()
    const options = [
      ...new Set(
        row.options
          .split(',')
          .map((option) => option.trim())
          .filter(Boolean)
      )
    ]
    if (!name && options.length === 0) {
      return
    }
    if (name === TASK_ID_VARIABLE) {
      errors[index] = 'reserved-name'
    } else if (!VARIABLE_NAME.test(name)) {
      errors[index] = 'invalid-name'
    } else if (name in variables) {
      errors[index] = 'duplicate-name'
    } else if (row.kind === 'text') {
      variables[name] = { kind: 'text' }
    } else if (options.length === 0) {
      errors[index] = 'missing-options'
    } else if (!options.every((option) => VARIABLE_OPTION.test(option))) {
      errors[index] = 'invalid-option'
    } else {
      variables[name] = { kind: 'select', options }
    }
  })
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, variables }
}

/** Variables the template uses that the project does not define; the composer asks for them as text. */
export function undefinedTemplateVariables(
  template: string,
  variables: ProjectBranchFormat['variables']
): string[] {
  return templateVariables(template).filter((name) => !(name in variables))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function migrateVariable(value: unknown): VariableSpec | null {
  // Version 1 stored a bare option list; an empty one meant free text.
  if (Array.isArray(value)) {
    const options = value.filter((option): option is string => typeof option === 'string')
    return options.length > 0 ? { kind: 'select', options } : { kind: 'text' }
  }
  if (isRecord(value) && value.kind === 'text') {
    return { kind: 'text' }
  }
  if (isRecord(value) && value.kind === 'select' && Array.isArray(value.options)) {
    return {
      kind: 'select',
      options: value.options.filter((option): option is string => typeof option === 'string')
    }
  }
  return null
}

/** Brings a persisted projects map to the current shape: `{var}` placeholders and typed variables. */
export function migrateStoredProjects(persisted: unknown): Record<string, ProjectBranchFormat> {
  const stored = isRecord(persisted) && isRecord(persisted.projects) ? persisted.projects : {}
  const projects: Record<string, ProjectBranchFormat> = {}
  for (const [repoId, entry] of Object.entries(stored)) {
    if (!isRecord(entry) || typeof entry.template !== 'string') {
      continue
    }
    const variables: Record<string, VariableSpec> = {}
    for (const [name, value] of Object.entries(isRecord(entry.variables) ? entry.variables : {})) {
      const spec = migrateVariable(value)
      if (spec) {
        variables[name] = spec
      }
    }
    projects[repoId] = {
      template: entry.template.replace(/\{\{\s*([a-z][a-z0-9-]*)\s*\}\}/gi, '{$1}'),
      variables
    }
  }
  return projects
}

export const BRANCH_FORMAT_SEARCH_ENTRY: SettingsSearchEntry = {
  title: 'Branch format',
  description: 'Branch name template and variables for new worktrees.',
  keywords: ['branch', 'rama', 'formato de rama', 'template', 'plantilla', 'prefix', 'task']
}
