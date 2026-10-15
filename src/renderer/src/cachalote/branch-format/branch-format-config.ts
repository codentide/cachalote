import type { ProjectBranchFormat } from './branch-format-settings'

// Starting formats, by the project's name in the sidebar. A project's own settings replace its seed
// (keyed by repo id) as soon as they are saved. `{{task-id}}` is built in: the task key in the
// workspace name (AX-3203), or the name as a slug when it has none.
const TYPE_OPTIONS = ['feature', 'fix', 'chore']
const COUNTRY_OPTIONS = ['co', 'mx', 'us', 'do', 'gb', 'pt', 'es', 'br', 'ec']

const typed: ProjectBranchFormat = {
  template: '{{type}}/{{task-id}}',
  variables: { type: TYPE_OPTIONS }
}
const typedByCountry: ProjectBranchFormat = {
  template: '{{type}}/{{country}}/{{task-id}}',
  variables: { type: TYPE_OPTIONS, country: COUNTRY_OPTIONS }
}

export const BRANCH_FORMAT_SEEDS: Readonly<Record<string, ProjectBranchFormat>> = {
  'ax-backend': { template: '{{task-id}}', variables: {} },
  'ax-admin': typed,
  'ax-app': typed,
  'ax-checkout': typed,
  'ax-strapi-admin': typed,
  'rs-landing': typed,
  'sc-landing': typed,
  'ax-landing': typedByCountry,
  'ax-landing-old': typedByCountry
}
