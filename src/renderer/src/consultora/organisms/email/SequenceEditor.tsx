import { Plus } from 'lucide-react'
import type { OutreachStep } from '@shared/marketing'
import { Button, Field } from '../../ui'
import { StepEditor } from '../../molecules/StepEditor'

export interface SequenceDraftValue {
  name: string
  steps: OutreachStep[]
}

const INPUT = 'bg-transparent text-[15px] text-ob-text outline-none placeholder:text-ob-faint'

export const emptyStep = (first: boolean): OutreachStep => ({
  wait: first ? '' : '2 days',
  subject: '',
  html: '',
  thread: first ? 'new' : 'reply'
})

export function SequenceEditor({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
  warning
}: {
  value: SequenceDraftValue
  onChange: (value: SequenceDraftValue) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  warning?: string | null
}): React.JSX.Element {
  const setStep = (i: number, step: OutreachStep): void =>
    onChange({ ...value, steps: value.steps.map((s, j) => (j === i ? step : s)) })

  const move = (i: number, delta: -1 | 1): void => {
    const steps = [...value.steps]
    const [item] = steps.splice(i, 1)
    steps.splice(i + delta, 0, item)
    onChange({ ...value, steps })
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {warning && (
        <p className="rounded-[6px] border-l-2 border-ob-accent bg-ob-accent/10 px-3 py-2 text-caption text-ob-link">
          {warning}
        </p>
      )}
      <Field label="Nombre de la secuencia">
        <input
          value={value.name}
          maxLength={120}
          placeholder="Ej. Restaurantes sin sitio web"
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          className={INPUT}
        />
      </Field>
      {value.steps.map((step, i) => (
        <StepEditor
          key={step.id ?? `nuevo-${i}`}
          step={step}
          index={i}
          total={value.steps.length}
          onChange={(next) => setStep(i, next)}
          onRemove={() => onChange({ ...value, steps: value.steps.filter((_, j) => j !== i) })}
          onMove={(delta) => move(i, delta)}
        />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => onChange({ ...value, steps: [...value.steps, emptyStep(false)] })}
          disabled={value.steps.length >= 10}
        >
          <Plus size={15} />
          Añadir email
        </Button>
        <span className="flex-1" />
        <Button onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button kind="primary" onClick={onSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </div>
  )
}
