import { ChevronRight, ListChecks } from 'lucide-react'
import type { SubtaskProgress as Progress } from '@shared/tasks'

interface SubtaskProgressProps {
  progress?: Progress

  onToggle?: () => void
  expanded?: boolean
}

export function SubtaskProgress({
  progress,
  onToggle,
  expanded = false
}: SubtaskProgressProps): React.JSX.Element | null {
  if (!progress || progress.total === 0) return null
  const complete = progress.done === progress.total
  const tone = complete ? 'bg-mint/15 text-mint' : 'bg-surface-raised text-milk-soft'
  const label = `${progress.done} de ${progress.total} subtareas hechas`
  const body = (
    <>
      <ListChecks size={12} strokeWidth={2.5} aria-hidden />
      {progress.done}/{progress.total}
    </>
  )

  if (!onToggle) {
    return (
      <span
        title={label}
        className={`inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-[12px] font-bold tabular-nums ${tone}`}
      >
        {body}
      </span>
    )
  }

  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-expanded={expanded}
      aria-label={`${label}. ${expanded ? 'Ocultar' : 'Ver'} subtareas`}
      title={`${expanded ? 'Ocultar' : 'Ver'} subtareas (→ ←)`}
      className={`inline-flex h-5 shrink-0 items-center gap-1 rounded-full pr-1 pl-1.5 text-[12px] font-bold tabular-nums transition-colors hover:text-milk ${tone}`}
    >
      {body}
      <ChevronRight
        size={12}
        strokeWidth={2.75}
        aria-hidden
        className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      />
    </button>
  )
}
