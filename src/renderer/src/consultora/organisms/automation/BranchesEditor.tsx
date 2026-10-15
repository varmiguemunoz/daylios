import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import {
  newBranch,
  type AutomationOptions,
  type Branch,
  type SubjectType
} from '@shared/automations'
import { INPUT } from '../../ui'
import { ConditionsEditor } from './ConditionsEditor'

export function BranchesEditor({
  branches,
  subject,
  options,
  onChange
}: {
  branches: Branch[]
  subject: SubjectType
  options: AutomationOptions | null
  onChange: (branches: Branch[]) => void
}): React.JSX.Element {
  const set = (i: number, branch: Branch): void =>
    onChange(branches.map((b, j) => (j === i ? branch : b)))
  const swap = (i: number, j: number): void => {
    const next = [...branches]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const icon =
    'grid size-7 shrink-0 place-items-center rounded-[4px] text-ob-muted hover:bg-ob-active hover:text-ob-text disabled:opacity-30'

  return (
    <div className="flex flex-col gap-3">
      {branches.map((branch, i) => (
        <div
          key={branch.id}
          className="flex flex-col gap-2 rounded-[6px] border border-ob-border p-2"
        >
          <div className="flex items-center gap-1">
            <input
              aria-label="Nombre de la rama"
              value={branch.name}
              onChange={(e) => set(i, { ...branch, name: e.target.value })}
              className={`${INPUT} font-medium`}
            />
            <button
              type="button"
              aria-label="Subir rama"
              disabled={i === 0}
              onClick={() => swap(i, i - 1)}
              className={icon}
            >
              <ArrowUp size={14} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Bajar rama"
              disabled={i === branches.length - 1}
              onClick={() => swap(i, i + 1)}
              className={icon}
            >
              <ArrowDown size={14} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Quitar rama"
              disabled={branches.length === 1}
              onClick={() => onChange(branches.filter((_, j) => j !== i))}
              className={`${icon} hover:!bg-ob-red/15 hover:!text-ob-red`}
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          <ConditionsEditor
            groups={branch.groups}
            subject={subject}
            options={options}
            onChange={(groups) => set(i, { ...branch, groups })}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...branches, newBranch(branches.length)])}
        className="flex h-7 items-center gap-1 self-start rounded-[4px] px-2 text-[12px] text-ob-muted hover:bg-ob-active hover:text-ob-text"
      >
        <Plus size={13} aria-hidden />
        Rama
      </button>
      <p className="rounded-[4px] bg-ob-alt px-2.5 py-2 text-[12px] text-ob-muted">
        <span className="font-medium text-ob-text">Ninguna</span> recoge lo que no cumple ninguna
        rama. Gana la primera rama que se cumple, de arriba abajo.
      </p>
    </div>
  )
}
