import { useState } from 'react'
import { GitBranch, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { createBrowserUuid } from '@/lib/browser-uuid'
import type { Repo } from '../../../../shared/repo-types'
import { renderBranchName } from './branch-format'
import { BRANCH_FORMAT_SEEDS } from './branch-format-config'
import { branchFormatLabel } from './branch-format-labels'
import { useBranchFormatProjectsStore } from './branch-format-projects-store'
import {
  parseVariableRows,
  undefinedTemplateVariables,
  variableRowsFrom,
  type ProjectBranchFormat,
  type VariableKind,
  type VariableRow
} from './branch-format-settings'

type DraftRow = VariableRow & { id: string }
type Draft = { template: string; rows: DraftRow[] }

const EMPTY_FORMAT: ProjectBranchFormat = { template: '', variables: {} }

function draftFrom(format: ProjectBranchFormat): Draft {
  return {
    template: format.template,
    rows: variableRowsFrom(format.variables).map((row) => ({ ...row, id: createBrowserUuid() }))
  }
}

function rowsText(rows: readonly VariableRow[]): string {
  return JSON.stringify(rows.map(({ name, kind, options }) => ({ name, kind, options })))
}

function isVariableKind(value: string): value is VariableKind {
  return value === 'select' || value === 'text'
}

export function BranchFormatSettingsSection({ repo }: { repo: Repo }): React.JSX.Element {
  const saved = useBranchFormatProjectsStore((s) => s.projects[repo.id])
  const saveProject = useBranchFormatProjectsStore((s) => s.saveProject)
  const resetProject = useBranchFormatProjectsStore((s) => s.resetProject)
  const seed = BRANCH_FORMAT_SEEDS[repo.displayName]
  // Not resolveProjectBranchFormat: it returns null for an empty template, which the editor must show.
  const base = saved ?? seed ?? EMPTY_FORMAT

  const [draft, setDraft] = useState<Draft>(() => draftFrom(base))
  const parsed = parseVariableRows(draft.rows)
  const dirty =
    draft.template !== base.template ||
    rowsText(draft.rows) !== rowsText(variableRowsFrom(base.variables))

  const knownVariables = parsed.ok ? parsed.variables : base.variables
  const undefinedNames = undefinedTemplateVariables(draft.template, knownVariables)
  const hasTemplate = draft.template.trim() !== ''
  const previewValues = Object.fromEntries(
    // A text variable previews as its own name; undefined variables render as ''.
    Object.entries(knownVariables).map(([name, spec]) => [
      name,
      spec.kind === 'select' ? (spec.options[0] ?? '') : name
    ])
  )

  const updateRow = (id: string, patch: Partial<VariableRow>): void =>
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    }))

  const handleSave = (): void => {
    if (!parsed.ok) {
      return
    }
    const format = { template: draft.template.trim(), variables: parsed.variables }
    saveProject(repo.id, format)
    // Re-read the saved form so trimmed text no longer counts as an unsaved change.
    setDraft(draftFrom(format))
  }

  const handleReset = (): void => {
    resetProject(repo.id)
    setDraft(draftFrom(seed ?? EMPTY_FORMAT))
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{branchFormatLabel('settingsTitle')}</h3>
        <p className="text-xs text-muted-foreground">{branchFormatLabel('settingsDescription')}</p>
      </div>

      <div className="space-y-2">
        <Input
          value={draft.template}
          onChange={(event) =>
            setDraft((current) => ({ ...current, template: event.target.value }))
          }
          aria-label={branchFormatLabel('template')}
          placeholder={branchFormatLabel('templatePlaceholder')}
          spellCheck={false}
        />
        {hasTemplate ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{branchFormatLabel('preview')}</span>
            <GitBranch className="size-3.5 shrink-0" />
            <span className="min-w-0 break-all font-mono">
              {renderBranchName({
                template: draft.template,
                name: 'AX-1234',
                values: previewValues
              })}
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{branchFormatLabel('formatOff')}</p>
        )}
        {undefinedNames.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {branchFormatLabel('undefinedVariables')} {undefinedNames.join(', ')}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium">{branchFormatLabel('variables')}</h4>
        {draft.rows.map((row, index) => {
          const error = !parsed.ok ? parsed.errors[index] : undefined
          return (
            <div key={row.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <Input
                  className="w-40"
                  value={row.name}
                  onChange={(event) => updateRow(row.id, { name: event.target.value })}
                  aria-label={branchFormatLabel('variableName')}
                  placeholder="country"
                  spellCheck={false}
                />
                <Select
                  value={row.kind}
                  onValueChange={(kind) => {
                    if (isVariableKind(kind)) {
                      updateRow(row.id, { kind })
                    }
                  }}
                >
                  <SelectTrigger size="sm" aria-label={branchFormatLabel('variableKind')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select">{branchFormatLabel('kindSelect')}</SelectItem>
                    <SelectItem value="text">{branchFormatLabel('kindText')}</SelectItem>
                  </SelectContent>
                </Select>
                {row.kind === 'select' ? (
                  <Input
                    className="min-w-0 flex-1"
                    value={row.options}
                    onChange={(event) => updateRow(row.id, { options: event.target.value })}
                    aria-label={branchFormatLabel('variableOptions')}
                    placeholder="co, mx, us"
                    spellCheck={false}
                  />
                ) : (
                  <div className="flex-1" />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={branchFormatLabel('removeVariable')}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      rows: current.rows.filter((entry) => entry.id !== row.id)
                    }))
                  }
                >
                  <X />
                </Button>
              </div>
              {error ? (
                <p className="text-xs text-destructive">{branchFormatLabel(error)}</p>
              ) : null}
            </div>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              rows: [
                ...current.rows,
                { name: '', kind: 'select', options: '', id: createBrowserUuid() }
              ]
            }))
          }
        >
          <Plus />
          {branchFormatLabel('addVariable')}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={!dirty || !parsed.ok} onClick={handleSave}>
          {branchFormatLabel('save')}
        </Button>
        {saved !== undefined ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
            {branchFormatLabel('reset')}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
