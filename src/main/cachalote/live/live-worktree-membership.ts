import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { gitExecFileAsync } from '../../git/command-runner/git-exec-file'
import { gitOptionalLocksDisabledEnv } from '../../git/command-runner/git-process-env'

async function commonGitDir(checkout: string): Promise<string | null> {
  try {
    const { stdout } = await gitExecFileAsync(['rev-parse', '--git-common-dir'], {
      cwd: checkout,
      env: gitOptionalLocksDisabledEnv()
    })
    const reported = stdout.trim()
    return reported ? await realpath(path.resolve(checkout, reported)) : null
  } catch {
    return null
  }
}

/** True when both checkouts share one git directory, i.e. the path really is a worktree of the repo. */
export async function isWorktreeOfRepo(repoPath: string, worktreePath: string): Promise<boolean> {
  const [repoDir, worktreeDir] = await Promise.all([
    commonGitDir(repoPath),
    commonGitDir(worktreePath)
  ])
  return repoDir !== null && repoDir === worktreeDir
}
