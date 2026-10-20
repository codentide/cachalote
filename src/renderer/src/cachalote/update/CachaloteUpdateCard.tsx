import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UpdateCheckFeedback } from '@/components/maintenance/update-card/UpdateCheckFeedback'
import * as rendererI18n from '@/i18n/i18n'
import type { CachaloteUpdateState } from '../../../../shared/cachalote/cachalote-update-state'

const TEXT = {
  checking: { es: 'Buscando actualizaciones…', en: 'Checking for updates…' },
  current: { es: 'Cachalote está al día', en: 'Cachalote is up to date' },
  unreachable: {
    es: 'No se pudo consultar si hay un release nuevo.',
    en: 'Could not check for a new release.'
  },
  running: { es: 'Ya hay una actualización en curso.', en: 'An update is already running.' },
  started: {
    es: 'Construyendo en segundo plano. Cachalote se reabre sola al terminar.',
    en: 'Building in the background. Cachalote reopens when done.'
  },
  failed: { es: 'Falló la actualización', en: 'Update failed' },
  title: { es: 'Actualización de Cachalote', en: 'Cachalote update' },
  release: { es: 'Release nuevo de upstream', en: 'New upstream release' },
  changes: { es: 'Cambios sin instalar', en: 'Changes not installed' },
  upstreamUnreachable: {
    es: 'No se pudo consultar upstream; se instalan solo tus cambios.',
    en: 'Upstream could not be checked; only your changes will be installed.'
  },
  warning: {
    es: 'El build tarda unos minutos. Al terminar, Cachalote se reinicia sola; las terminales y sus agentes siguen corriendo.',
    en: 'The build takes a few minutes. When it finishes, Cachalote restarts by itself; terminals and their agents keep running.'
  },
  update: { es: 'Actualizar', en: 'Update' },
  dismiss: { es: 'Cerrar', en: 'Dismiss' },
  updatedTitle: { es: 'Cachalote actualizada', en: 'Cachalote updated' },
  reapplied: {
    es: 'Choques con upstream resueltos solos',
    en: 'Upstream conflicts resolved on their own'
  },
  resolved: {
    es: 'Choques que resolvió Claude (revisados por otro Claude)',
    en: 'Conflicts Claude resolved (reviewed by another Claude)'
  },
  pendingTests: {
    es: 'Pendiente: pruebas que ya no compilan (no afectan la app)',
    en: 'Pending: tests that no longer typecheck (the app is not affected)'
  }
} as const

function text(key: keyof typeof TEXT): string {
  // Tests that mock this module with `translate` only would throw on the instance.
  try {
    return rendererI18n.i18n.language?.startsWith('es') ? TEXT[key].es : TEXT[key].en
  } catch {
    return TEXT[key].en
  }
}

const CURRENT_VISIBLE_MS = 4_000

function FileList({
  label,
  files
}: {
  label: string
  files: readonly string[]
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">
        {label} ({files.length})
      </p>
      <ul className="flex flex-col gap-1">
        {files.map((file) => (
          <li key={file} title={file} className="truncate font-mono text-xs">
            {file.split('/').pop()}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Bottom-right card for Cachalote's own update flow (cachalote-sync), next to upstream's. */
export function CachaloteUpdateCard(): React.JSX.Element | null {
  const [state, setState] = useState<CachaloteUpdateState | null>(null)

  useEffect(() => window.api.updater.onCachaloteState?.(setState), [])

  // "Up to date" is a confirmation, not a decision: let it go on its own.
  useEffect(() => {
    if (state?.kind !== 'current') {
      return
    }
    const timer = window.setTimeout(() => setState(null), CURRENT_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [state])

  if (!state) {
    return null
  }
  const dismiss = (): void => setState(null)

  return (
    // Same surface as upstream's notification cards (Card with py-0 gap-0), without restyling the primitive.
    <div
      role="complementary"
      aria-live="polite"
      className="animate-update-card-enter flex flex-col rounded-xl border border-border/50 bg-card text-card-foreground shadow-sm"
    >
      {state.kind === 'checking' && <UpdateCheckFeedback icon="spinner" text={text('checking')} />}
      {state.kind === 'current' && (
        <UpdateCheckFeedback
          icon="check"
          text={
            state.version ? `${text('current')} · ${state.version.split('-')[0]}` : text('current')
          }
          onClose={dismiss}
        />
      )}
      {state.kind === 'unreachable' && (
        <UpdateCheckFeedback icon="error" text={text('unreachable')} onClose={dismiss} />
      )}
      {state.kind === 'running' && (
        <UpdateCheckFeedback icon="spinner" text={text('running')} onClose={dismiss} />
      )}
      {state.kind === 'started' && (
        <UpdateCheckFeedback icon="spinner" text={text('started')} onClose={dismiss} />
      )}
      {state.kind === 'failed' && (
        <UpdateCheckFeedback
          icon="error"
          text={`${text('failed')}: ${state.message}`}
          onClose={dismiss}
        />
      )}
      {state.kind === 'updated' && (
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {state.release ? `${text('updatedTitle')} · ${state.release}` : text('updatedTitle')}
            </h3>
            <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label={text('dismiss')}>
              <X className="size-3.5" />
            </Button>
          </div>
          {state.reappliedFiles.length > 0 && (
            <FileList label={text('reapplied')} files={state.reappliedFiles} />
          )}
          {state.resolvedFiles.length > 0 && (
            <FileList label={text('resolved')} files={state.resolvedFiles} />
          )}
          {state.pendingTestFiles.length > 0 && (
            <FileList label={text('pendingTests')} files={state.pendingTestFiles} />
          )}
        </div>
      )}
      {state.kind === 'available' && (
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold">{text('title')}</h3>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={dismiss}
              aria-label={text('dismiss')}
            >
              <X className="size-3.5" />
            </Button>
          </div>
          {state.release && (
            <p className="text-sm text-muted-foreground">
              {text('release')}:{' '}
              <span className="font-medium text-foreground">{state.release}</span>
            </p>
          )}
          {state.changes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">
                {text('changes')} ({state.changes.length})
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {state.changes.map((change) => (
                  <li key={change} className="flex gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span className="min-w-0">{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {state.upstreamUnreachable && (
            <p className="text-xs text-muted-foreground">{text('upstreamUnreachable')}</p>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">{text('warning')}</p>
          <Button
            variant="default"
            size="sm"
            className="w-full cursor-pointer"
            onClick={() => {
              setState({ kind: 'checking' })
              void window.api.updater.cachaloteStart?.()
            }}
          >
            {text('update')}
          </Button>
        </div>
      )}
    </div>
  )
}
