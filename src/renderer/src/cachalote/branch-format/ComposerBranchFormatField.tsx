import { useEffect, useId, useRef } from 'react'
import { GitBranch } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useAppStore } from '@/store'
import type { NewWorkspaceComposerCardProps } from '../../components/new-workspace/new-workspace-composer-card-props'
import { BRANCH_FORMAT_SEEDS } from './branch-format-config'
import { renderBranchName, templateVariables } from './branch-format'
import { useBranchFormatChoicesStore } from './branch-format-choices-store'
import { branchFormatLabel } from './branch-format-labels'
import { useBranchFormatProjectsStore } from './branch-format-projects-store'
import { resolveProjectBranchFormat, type ProjectBranchFormat } from './branch-format-settings'

type ComposerBranchFormatFieldProps = Pick<
  NewWorkspaceComposerCardProps,
  | 'repoId'
  | 'name'
  | 'branchNameOverride'
  | 'onBranchNameOverrideChange'
  | 'smartNameMode'
  | 'smartNameSelection'
>

/** Names the new branch from the project's format; renders nothing for projects without one. */
export function ComposerBranchFormatField(
  props: ComposerBranchFormatFieldProps
): React.JSX.Element | null {
  const displayName = useAppStore(
    (s) => s.repos.find((repo) => repo.id === props.repoId)?.displayName ?? null
  )
  const projects = useBranchFormatProjectsStore((s) => s.projects)
  const format = resolveProjectBranchFormat({
    repoId: props.repoId,
    displayName,
    projects,
    seeds: BRANCH_FORMAT_SEEDS
  })
  if (!format) {
    return null
  }
  // Keyed so switching project drops the previous project's applied branch.
  return <BranchFormatRows key={props.repoId} format={format} {...props} />
}

function BranchFormatRows({
  format,
  repoId,
  name,
  branchNameOverride,
  onBranchNameOverrideChange,
  smartNameMode,
  smartNameSelection
}: ComposerBranchFormatFieldProps & { format: ProjectBranchFormat }): React.JSX.Element {
  const labelId = useId()
  const savedChoices = useBranchFormatChoicesStore((s) => s.choices[repoId])
  const setChoice = useBranchFormatChoicesStore((s) => s.setChoice)
  const appliedBranchRef = useRef<string | undefined>(undefined)

  const variables = templateVariables(format.template)
  const values: Record<string, string> = {}
  for (const variable of variables) {
    const options = format.variables[variable]
    const saved = savedChoices?.[variable]
    values[variable] =
      options && options.length > 0
        ? saved && options.includes(saved)
          ? saved
          : (options[0] ?? '')
        : (saved ?? '')
  }
  // Only a new branch named from typed text: picked PRs, issues and branches name themselves.
  const active =
    smartNameSelection === null &&
    (smartNameMode === undefined || smartNameMode === 'smart' || smartNameMode === 'text')
  const branch = active ? renderBranchName({ template: format.template, name, values }) : null

  useEffect(() => {
    // A branch typed by hand under Advanced wins until it is cleared.
    if (branchNameOverride !== undefined && branchNameOverride !== appliedBranchRef.current) {
      return
    }
    const next = branch ?? undefined
    if (next === branchNameOverride) {
      return
    }
    appliedBranchRef.current = next
    onBranchNameOverrideChange(next)
  }, [branch, branchNameOverride, onBranchNameOverrideChange])

  return (
    <div role="group" aria-labelledby={labelId} className="space-y-1.5">
      <span id={labelId} className="block text-xs font-medium text-muted-foreground">
        {branchFormatLabel('field')}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {variables.map((variable) => {
          const options = format.variables[variable]
          return options && options.length > 0 ? (
            <Select
              key={variable}
              value={values[variable]}
              onValueChange={(value) => setChoice(repoId, variable, value)}
            >
              <SelectTrigger size="sm" aria-label={variable}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              key={variable}
              aria-label={variable}
              placeholder={variable}
              value={values[variable]}
              onChange={(event) => setChoice(repoId, variable, event.target.value)}
              className="w-32"
            />
          )
        })}
        {branch ? (
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <GitBranch className="size-3 shrink-0" />
            <span className="truncate font-mono">{branch}</span>
          </span>
        ) : null}
      </div>
    </div>
  )
}
