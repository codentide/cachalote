import type { HandlerGroup } from '../handler-group-manifest'

export const CACHALOTE_HANDLER_GROUPS: readonly HandlerGroup[] = [
  {
    name: 'sonar',
    keys: ['sonar status', 'sonar serve', 'sonar logs', 'sonar stop'],
    load: async () => (await import('./sonar-handlers.js')).SONAR_HANDLERS
  }
]
