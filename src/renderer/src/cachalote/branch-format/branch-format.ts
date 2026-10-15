import { sanitizeBranchSlug } from '../../../../shared/branch-name-from-work'

export const TASK_ID_VARIABLE = 'task-id'
/** Jira-style keys: project letters, then the number, joined as `KEY-123`. */
export const TASK_ID_PATTERN = /\b([a-z]{2,6})[-_ ]?(\d{2,6})\b/i

const PLACEHOLDER = /\{\s*([a-z][a-z0-9-]*)\s*\}/gi
// A name with no task id still becomes a readable leaf, not a 4-word cut.
const FALLBACK_SLUG_WORDS = 8
// Characters git rejects in a ref name (git check-ref-format), besides spaces and slashes.
// oxlint-disable-next-line no-control-regex -- control characters are exactly what git rejects.
const INVALID_REF_CHARACTERS = /[~^:?*[\\\x00-\x1f\x7f]/g

/** `AX-3203`, `ax 3203` and `ax_3203` all read as `AX-3203`; null when the text has no task id. */
export function extractTaskId(text: string): string | null {
  const match = text.match(TASK_ID_PATTERN)
  return match?.[1] && match[2] ? `${match[1].toUpperCase()}-${match[2]}` : null
}

/** Free text as one branch path segment: spaces become dashes, characters git rejects go. */
export function toBranchSegment(value: string): string {
  return value
    .trim()
    .replace(/[\s/]+/g, '-')
    .replace(INVALID_REF_CHARACTERS, '')
    .replace(/\.{2,}/g, '.')
    .replace(/-{2,}/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
}

/** The task id a worktree name implies: its task key, else the name as a slug ('' when empty). */
export function taskIdFromName(name: string): string {
  return extractTaskId(name) ?? sanitizeBranchSlug(name, FALLBACK_SLUG_WORDS)
}

/** Every placeholder a template uses, in order and once, the task id included. */
export function templatePlaceholders(template: string): string[] {
  const names = new Set<string>()
  for (const match of template.matchAll(PLACEHOLDER)) {
    names.add(match[1]!.toLowerCase())
  }
  return [...names]
}

/** The variables a template asks for, without the built-in task id. */
export function templateVariables(template: string): string[] {
  return templatePlaceholders(template).filter((name) => name !== TASK_ID_VARIABLE)
}

/**
 * Fills a template into a branch name, or null when there is no task id.
 * A typed task id wins over the one the worktree name implies; an empty variable
 * drops its segment instead of leaving `//` behind.
 */
export function renderBranchName(args: {
  template: string
  name: string
  values: Readonly<Record<string, string>>
  taskId?: string
}): string | null {
  const typedTaskId = args.taskId?.trim()
  const taskId = typedTaskId
    ? (extractTaskId(typedTaskId) ?? toBranchSegment(typedTaskId))
    : taskIdFromName(args.name)
  if (!taskId) {
    return null
  }
  const filled = args.template.replace(PLACEHOLDER, (_, rawName: string) => {
    const name = rawName.toLowerCase()
    return name === TASK_ID_VARIABLE ? taskId : toBranchSegment(args.values[name] ?? '')
  })
  const branch = filled
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/')
  return branch || null
}
