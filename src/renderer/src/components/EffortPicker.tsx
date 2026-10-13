import { EFFORTS, type Effort } from '@shared/tasks'

const EFFORT_LABEL: Record<Effort, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' }

/** Esfuerzo de una tarea: clic elige, clic otra vez quita. */
export function EffortPicker({
  effort,
  onChange
}: {
  effort: Effort | null
  onChange: (effort: Effort | null) => void
}): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label="Esfuerzo" className="flex w-fit rounded-full bg-surface p-1">
      {EFFORTS.map((level) => {
        const active = effort === level
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? null : level)}
            className={`h-8 rounded-full px-4 text-caption font-bold transition-colors ${
              active ? 'bg-surface-raised text-milk' : 'text-milk-soft hover:text-milk'
            }`}
          >
            {EFFORT_LABEL[level]}
          </button>
        )
      })}
    </div>
  )
}
