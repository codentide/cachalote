import { sanitizeBranchSlug } from '../../../../shared/branch-name-from-work'

export const TASK_ID_VARIABLE = 'task-id'
/** Jira-style keys: project letters, then the number, joined as `KEY-123`. */
export const TASK_ID_PATTERN = /\b([a-z]{2,6})[-_ ]?(\d{2,6})\b/i

const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9-]*)\s*\}\}/gi
// A name with no task id still becomes a readable leaf, not a 4-word cut.
const FALLBACK_SLUG_WORDS = 8

/** `AX-3203`, `ax 3203` and `ax_3203` all read as `AX-3203`; null when the name has no task id. */
export function extractTaskId(name: string): string | null {
  const match = name.match(TASK_ID_PATTERN)
  return match?.[1] && match[2] ? `${match[1].toUpperCase()}-${match[2]}` : null
}

/** The variables a template asks for, in order and without the built-in task id. */
export function templateVariables(template: string): string[] {
  const names = new Set<string>()
  for (const match of template.matchAll(PLACEHOLDER)) {
    const name = match[1]!.toLowerCase()
    if (name !== TASK_ID_VARIABLE) {
      names.add(name)
    }
  }
  return [...names]
}

/**
 * Fills a template into a branch name, or null when the workspace name is empty.
 * An empty variable drops its segment instead of leaving `//` behind.
 */
export function renderBranchName(args: {
  template: string
  name: string
  values: Readonly<Record<string, string>>
}): string | null {
  const taskId = extractTaskId(args.name) ?? sanitizeBranchSlug(args.name, FALLBACK_SLUG_WORDS)
  if (!taskId) {
    return null
  }
  const filled = args.template.replace(PLACEHOLDER, (_, rawName: string) => {
    const name = rawName.toLowerCase()
    const value = name === TASK_ID_VARIABLE ? taskId : (args.values[name] ?? '')
    return value.trim().replace(/\s+/g, '-')
  })
  const branch = filled
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/')
  return branch || null
}
