import type { ProjectBranchFormat, VariableSpec } from './branch-format-settings'

// Starting formats, by the project's name in the sidebar. A project's own settings replace its seed
// (keyed by repo id) as soon as they are saved. `{task-id}` is built in: a field in the composer,
// which falls back to the task key in the worktree name (AX-3203), or the name as a slug.
const TYPE: VariableSpec = { kind: 'select', options: ['feature', 'fix', 'chore'] }
const COUNTRY: VariableSpec = {
  kind: 'select',
  options: ['co', 'mx', 'us', 'do', 'gb', 'pt', 'es', 'br', 'ec']
}

const typed: ProjectBranchFormat = {
  template: '{type}/{task-id}',
  variables: { type: TYPE }
}
const typedByCountry: ProjectBranchFormat = {
  template: '{type}/{country}/{task-id}',
  variables: { type: TYPE, country: COUNTRY }
}

export const BRANCH_FORMAT_SEEDS: Readonly<Record<string, ProjectBranchFormat>> = {
  'ax-backend': { template: '{task-id}', variables: {} },
  'ax-admin': typed,
  'ax-app': typed,
  'ax-checkout': typed,
  'ax-strapi-admin': typed,
  'rs-landing': typed,
  'sc-landing': typed,
  'ax-landing': typedByCountry,
  'ax-landing-old': typedByCountry
}
