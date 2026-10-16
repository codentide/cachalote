import { useCallback, useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { cn } from '@/lib/utils'
import { isFolderRepo } from '../../../../shared/repo-kind'
import type { Repo } from '../../../../shared/repo-types'
import type { LiveConfigEntry, LiveConfigError } from '../../../../shared/cachalote/live/live-types'
import { liveLabel } from './live-labels'
import {
  configFingerprint,
  configFromDrafts,
  draftFromSlot,
  emptySlotDraft,
  errorsForSlot,
  liveConfigErrorText,
  validateDrafts,
  type SlotDraft
} from './live-settings-model'
import { liveApi, useLiveStore, useLiveStoreStarted } from './live-store'

type TextField = 'id' | 'label' | 'port' | 'install' | 'start' | 'depsFiles' | 'envFiles'

function FieldError({ text }: { text: string | undefined }): React.JSX.Element | null {
  return text ? <p className="text-xs text-destructive">{text}</p> : null
}

function LiveSettingsEditor({ repo }: { repo: Repo }): React.JSX.Element {
  const [entry, setEntry] = useState<LiveConfigEntry | null>(null)
  const [drafts, setDrafts] = useState<SlotDraft[]>([])
  const [loadFailed, setLoadFailed] = useState(false)
  const [mainErrors, setMainErrors] = useState<LiveConfigError[]>([])
  const [saving, setSaving] = useState(false)

  const applyEntry = useCallback((next: LiveConfigEntry | null) => {
    setEntry(next)
    setDrafts((next?.config.slots ?? []).map((slot) => draftFromSlot(slot, createBrowserUuid())))
    setMainErrors([])
  }, [])

  useEffect(() => {
    let cancelled = false
    void liveApi()
      ?.getConfig(repo.id)
      .then((loaded) => {
        if (!cancelled) {
          applyEntry(loaded)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [repo.id, applyEntry])

  const baseFingerprint = entry
    ? configFingerprint(entry.config)
    : configFingerprint({ repoId: repo.id, slots: [] })
  const config = configFromDrafts(repo.id, drafts)
  const localErrors = validateDrafts(repo.id, drafts)
  const errors = [...localErrors, ...mainErrors]
  const dirty = configFingerprint(config) !== baseFingerprint

  const updateDraft = (key: string, patch: Partial<SlotDraft>): void => {
    setMainErrors([])
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft))
    )
  }

  const reload = async (): Promise<void> => {
    const loaded = (await liveApi()?.getConfig(repo.id)) ?? null
    applyEntry(loaded)
  }

  const handleSave = async (): Promise<void> => {
    const api = liveApi()
    if (!api) {
      return
    }
    setSaving(true)
    try {
      const result = await api.saveConfig(config)
      if (result.ok) {
        await reload()
      } else {
        setMainErrors(result.errors)
      }
    } catch (error) {
      toast.error(liveLabel('actionFailed'), {
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (): Promise<void> => {
    try {
      await liveApi()?.resetConfig(repo.id)
      await reload()
    } catch (error) {
      toast.error(liveLabel('actionFailed'), {
        description: error instanceof Error ? error.message : String(error)
      })
    }
  }

  const projectErrors = mainErrors.filter((error) => error.slotIndex < 0)

  const textInput = (
    draft: SlotDraft,
    field: TextField,
    labelKey: Parameters<typeof liveLabel>[0],
    placeholder: string,
    className?: string
  ): React.JSX.Element => (
    // Visible label: once filled, install and start look alike without one.
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs text-muted-foreground">{liveLabel(labelKey)}</span>
      <Input
        value={draft[field]}
        onChange={(event) => updateDraft(draft.key, { [field]: event.target.value })}
        placeholder={placeholder}
        spellCheck={false}
      />
    </label>
  )

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{liveLabel('name')}</h3>
        <p className="text-xs text-muted-foreground">{liveLabel('settingsDescription')}</p>
      </div>

      {loadFailed ? <p className="text-xs text-destructive">{liveLabel('loadFailed')}</p> : null}
      {projectErrors.map((error) => (
        <FieldError key={`${error.field}:${error.reason}`} text={liveConfigErrorText(error)} />
      ))}

      <div className="space-y-3">
        {drafts.length === 0 && entry ? (
          <p className="text-xs text-muted-foreground">{liveLabel('noSlots')}</p>
        ) : null}
        {drafts.map((draft, index) => {
          const slotErrors = errorsForSlot(errors, index)
          return (
            <div key={draft.key} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-end gap-2">
                {textInput(draft, 'label', 'slotLabel', 'API', 'w-32')}
                {textInput(draft, 'id', 'slotId', 'api', 'w-32')}
                {textInput(draft, 'port', 'slotPort', '8080', 'w-24')}
                <div className="flex-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={liveLabel('removeSlot')}
                  onClick={() => {
                    setMainErrors([])
                    setDrafts((current) => current.filter((item) => item.key !== draft.key))
                  }}
                >
                  <X />
                </Button>
              </div>
              <FieldError text={slotErrors.label} />
              <FieldError text={slotErrors.id} />
              <FieldError text={slotErrors.port} />
              {textInput(draft, 'install', 'slotInstall', 'pnpm install --frozen-lockfile')}
              {textInput(draft, 'start', 'slotStart', 'pnpm dev')}
              <FieldError text={slotErrors.start} />
              {textInput(draft, 'depsFiles', 'slotDepsFiles', 'package.json, pnpm-lock.yaml')}
              <FieldError text={slotErrors.depsFiles} />
              {textInput(draft, 'envFiles', 'slotEnvFiles', '.env*, credentials_*.env')}
              <FieldError text={slotErrors.envFiles} />
            </div>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setMainErrors([])
            setDrafts((current) => [...current, emptySlotDraft(createBrowserUuid())])
          }}
        >
          <Plus />
          {liveLabel('addSlot')}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!dirty || localErrors.length > 0 || saving}
          onClick={() => void handleSave()}
        >
          {liveLabel('save')}
        </Button>
        {entry?.source === 'saved' ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => void handleReset()}>
            {liveLabel('reset')}
          </Button>
        ) : null}
      </div>
    </section>
  )
}

/** Settings → project → Sonar: the project's slots. */
export function LiveSettingsSection({ repo }: { repo: Repo }): React.JSX.Element | null {
  useLiveStoreStarted()
  const supported = useLiveStore((s) => s.supported)
  // Folder and SSH projects have no runner, so main never offers them slots.
  if (!supported || isFolderRepo(repo) || repo.connectionId) {
    return null
  }
  return <LiveSettingsEditor repo={repo} />
}
