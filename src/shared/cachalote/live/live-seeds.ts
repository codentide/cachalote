import type { LiveProjectConfig, LiveSlotConfig } from './live-types'

export const DEFAULT_LIVE_ENV_FILES: readonly string[] = ['.env*', 'credentials_*.env']

// Starting slots, by the project's name in the sidebar; a saved config (keyed by repo id) replaces it.
const SEEDS: Readonly<Record<string, readonly LiveSlotConfig[]>> = {
  'ax-backend': [
    {
      id: 'api',
      label: 'API',
      port: 8080,
      install: 'uv sync --frozen',
      start:
        'DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib uv run --frozen --env-file credentials_local.env python main.py',
      depsFiles: ['pyproject.toml', 'uv.lock'],
      envFiles: [...DEFAULT_LIVE_ENV_FILES]
    }
  ],
  'ax-admin': [
    {
      id: 'web',
      label: 'Web',
      port: 3000,
      install: 'pnpm install --frozen-lockfile',
      start: 'pnpm dev',
      depsFiles: ['package.json', 'pnpm-lock.yaml'],
      envFiles: [...DEFAULT_LIVE_ENV_FILES]
    }
  ],
  'ax-app': [
    {
      id: 'metro',
      label: 'Metro',
      port: 8081,
      install: 'yarn install --frozen-lockfile',
      start: 'yarn start:development',
      depsFiles: ['package.json', 'yarn.lock'],
      envFiles: [...DEFAULT_LIVE_ENV_FILES]
    }
  ]
}

/** The seeded config for a project, by its sidebar name; null when it has none. */
export function liveSeedFor(repoId: string, displayName: string): LiveProjectConfig | null {
  const slots = SEEDS[displayName]
  return slots
    ? {
        repoId,
        slots: slots.map((slot) => ({
          ...slot,
          depsFiles: [...slot.depsFiles],
          envFiles: [...slot.envFiles]
        }))
      }
    : null
}
