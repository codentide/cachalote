import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const SONAR_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['sonar', 'status'],
    summary: "Show the project's Sonar ports and which worktree each one serves",
    usage: 'orca sonar status [--worktree <selector>] [--all] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree', 'all'],
    notes: [
      'Shows the ports of the project that owns the worktree. --all shows every project, and is the default outside any worktree.'
    ]
  },
  {
    path: ['sonar', 'serve'],
    summary: "Serve a worktree on the project's fixed port and wait until it is up",
    usage:
      'orca sonar serve [--worktree <selector>] [--port <n> | --slot <id>] [--force] [--timeout-ms <ms>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree', 'port', 'slot', 'force', 'timeout-ms'],
    notes: [
      'To see your change running, use `orca sonar serve` instead of starting a dev server: it serves this worktree on the project fixed port and waits until it is up.',
      'Exits 1 when the server fails, the port is held by another worktree (pass --force to take it), or --timeout-ms (default 300000) passes first.',
      '--timeout-ms 0 returns as soon as the request is accepted. Pass --port when the project has several ports.'
    ],
    examples: ['orca sonar serve', 'orca sonar serve --port 3001 --timeout-ms 120000 --json']
  },
  {
    path: ['sonar', 'logs'],
    summary: 'Print the recent output of the server on a Sonar port',
    usage:
      'orca sonar logs [--worktree <selector>] [--port <n> | --slot <id>] [--limit <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree', 'port', 'slot', 'limit'],
    notes: ['Defaults to the port already serving this worktree. Lines are oldest first.'],
    examples: ['orca sonar logs --limit 200']
  },
  {
    path: ['sonar', 'stop'],
    summary: 'Stop the server on a Sonar port',
    usage: 'orca sonar stop [--worktree <selector>] [--port <n> | --slot <id>] [--force] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree', 'port', 'slot', 'force'],
    notes: [
      'Defaults to the port already serving this worktree. A port serving another worktree is left alone unless --force.'
    ]
  }
]
