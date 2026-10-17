const PORT_HELP = '--port <n>             Sonar port to act on when the project has several'
const SLOT_HELP = '--slot <id>            Sonar slot id, instead of --port'

// The shared --force and --limit lines describe other commands (worktree removal, list size).
export const SONAR_FLAG_HELP: Record<string, Record<string, string>> = {
  'sonar status': {
    all: "--all                  Show every project's ports, not only this worktree's project"
  },
  'sonar serve': {
    port: PORT_HELP,
    slot: SLOT_HELP,
    force: '--force                Take the port even while another worktree is serving it',
    'timeout-ms':
      '--timeout-ms <ms>      Wait limit (default 300000); 0 returns once the request is accepted'
  },
  'sonar logs': {
    port: PORT_HELP,
    slot: SLOT_HELP,
    limit: '--limit <n>            Lines of server output (default 80)'
  },
  'sonar stop': {
    port: PORT_HELP,
    slot: SLOT_HELP,
    force: '--force                Stop the port even while another worktree is serving it'
  }
}
