import { AlertCircle, Plus } from 'lucide-react'
import { NodeIcon } from '../../atoms/NodeIcon'

export interface TriggerCardProps {
  icon: string
  label: string
  sentence: string
  filters: number
  issues: string[]
  selected?: boolean
  onClick: () => void
}

export function TriggerCard({
  icon,
  label,
  sentence,
  filters,
  issues,
  selected,
  onClick
}: TriggerCardProps): React.JSX.Element {
  const ring = selected
    ? 'border-ob-accent ring-1 ring-ob-accent'
    : issues.length
      ? 'border-ob-orange/60'
      : 'border-dashed border-[#4a4a4a] hover:border-ob-muted'
  return (
    <button
      type="button"
      onClick={onClick}
      title={issues.length ? issues.join('\n') : sentence}
      className={`nodrag nopan flex h-full w-full flex-col justify-center gap-1 rounded-[6px] border bg-ob-alt px-3 text-left transition-colors ${ring}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-[4px] bg-ob-accent/15 text-ob-link">
          <NodeIcon name={icon} size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold tracking-wide text-ob-muted uppercase">
          {label}
        </span>
        {issues.length > 0 && (
          <AlertCircle size={13} className="shrink-0 text-ob-orange" aria-label="Con errores" />
        )}
      </span>
      <span className="min-w-0 truncate text-[13px] text-ob-text">
        {sentence}
        {filters > 0 && (
          <span className="text-ob-muted">
            {' '}
            · {filters} {filters === 1 ? 'filtro' : 'filtros'}
          </span>
        )}
      </span>
    </button>
  )
}

export function AddTriggerCard({
  selected,
  onClick
}: {
  selected?: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`nodrag nopan flex h-full w-full items-center justify-center gap-2 rounded-[6px] border border-dashed text-[13px] transition-colors ${
        selected
          ? 'border-ob-accent text-ob-link'
          : 'border-[#4a4a4a] text-ob-muted hover:border-ob-muted hover:text-ob-text'
      }`}
    >
      <Plus size={15} aria-hidden />
      Añadir trigger
    </button>
  )
}
