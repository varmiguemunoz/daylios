import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import type { OutreachStep } from '@shared/marketing'
import { Field } from '../ui'
import { RichTextEditor } from './RichTextEditor'
import { WaitField } from './WaitField'

const INPUT = 'bg-transparent text-[14px] text-ob-text outline-none placeholder:text-ob-faint'
const ICON =
  'grid size-7 place-items-center rounded-[4px] text-ob-muted hover:bg-ob-hover hover:text-ob-text disabled:opacity-30'

export function StepEditor({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMove
}: {
  step: OutreachStep
  index: number
  total: number
  onChange: (step: OutreachStep) => void
  onRemove: () => void
  onMove: (delta: -1 | 1) => void
}): React.JSX.Element {
  const first = index === 0
  const reply = !first && step.thread === 'reply'
  return (
    <section className="flex flex-col gap-2 rounded-[6px] border border-ob-border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-semibold text-ob-text">Email {index + 1}</span>
        {!first && (
          <WaitField
            value={step.wait || '2 days'}
            onChange={(wait) => onChange({ ...step, wait })}
          />
        )}
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Subir"
            title="Subir"
            disabled={first}
            onClick={() => onMove(-1)}
            className={ICON}
          >
            <ArrowUp size={15} />
          </button>
          <button
            type="button"
            aria-label="Bajar"
            title="Bajar"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className={ICON}
          >
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            aria-label="Quitar email"
            title="Quitar email"
            disabled={total === 1}
            onClick={onRemove}
            className={ICON}
          >
            <Trash2 size={15} />
          </button>
        </span>
      </div>
      {!first && (
        <label className="flex items-center gap-2 text-[13px] text-ob-muted">
          <input
            type="checkbox"
            checked={reply}
            onChange={(e) =>
              onChange({
                ...step,
                thread: e.target.checked ? 'reply' : 'new',
                subject: e.target.checked ? '' : step.subject
              })
            }
          />
          Responder en el mismo hilo del email anterior
        </label>
      )}
      {!reply && (
        <Field label="Asunto">
          <input
            value={step.subject}
            maxLength={200}
            placeholder="Asunto del email"
            onChange={(e) => onChange({ ...step, subject: e.target.value })}
            className={INPUT}
          />
        </Field>
      )}
      <RichTextEditor
        label={`Cuerpo del email ${index + 1}`}
        value={step.html}
        onChange={(html) => onChange({ ...step, html })}
      />
    </section>
  )
}
