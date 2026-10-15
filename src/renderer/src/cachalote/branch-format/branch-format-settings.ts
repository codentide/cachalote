import type { SettingsSearchEntry } from '../../components/settings/settings-search'
import { TASK_ID_VARIABLE, templateVariables } from './branch-format'

/** A project's branch format: its template and the variables it offers. */
export type ProjectBranchFormat = {
  /** '' turns the format off for the project. */
  template: string
  /** Variable name → options; no options means free text in the composer. */
  variables: Readonly<Record<string, readonly string[]>>
}

/** One editable row of the settings section; options are comma-separated. */
export type VariableRow = { name: string; options: string }

export type VariableRowError =
  | 'invalid-name'
  | 'duplicate-name'
  | 'reserved-name'
  | 'invalid-option'

export type ParsedVariableRows =
  | { ok: true; variables: Record<string, string[]> }
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
  return Object.entries(variables).map(([name, options]) => ({ name, options: options.join(', ') }))
}

/** Validates the editor rows; fully empty rows are ignored. */
export function parseVariableRows(rows: readonly VariableRow[]): ParsedVariableRows {
  const variables: Record<string, string[]> = {}
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
    } else if (!options.every((option) => VARIABLE_OPTION.test(option))) {
      errors[index] = 'invalid-option'
    } else {
      variables[name] = options
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

export const BRANCH_FORMAT_SEARCH_ENTRY: SettingsSearchEntry = {
  title: 'Branch format',
  description: 'Branch name template and variables for new worktrees.',
  keywords: ['branch', 'rama', 'formato de rama', 'template', 'plantilla', 'prefix', 'task']
}
