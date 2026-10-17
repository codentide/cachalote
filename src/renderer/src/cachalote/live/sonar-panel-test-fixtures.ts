import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'

// App-store records for Sonar panel tests.

export function sonarRepo(id: string, displayName: string): Repo {
  return { id, path: `/repos/${id}`, displayName, badgeColor: '#000000', addedAt: 0 }
}

export function sonarWorktree(
  repoId: string,
  name: string,
  overrides: Partial<Worktree> = {}
): Worktree {
  const path = `/wt/${repoId}/${name}`
  return {
    id: `${repoId}::${path}`,
    repoId,
    path,
    head: 'abc123',
    branch: `refs/heads/${name}`,
    isBare: false,
    isMainWorktree: false,
    displayName: name,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    ...overrides
  }
}
