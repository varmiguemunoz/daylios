import type { OutreachStep } from '@shared/marketing'
import { sanitizeEmailHtml } from '../../lib/email-html'
import { HtmlPreview } from '../atoms/HtmlPreview'

export function StepPreview({
  step,
  index
}: {
  step: OutreachStep
  index: number
}): React.JSX.Element {
  const reply = index > 0 && step.thread === 'reply'
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold text-ob-text">Email {index + 1}</span>
        <span className="text-caption text-ob-muted">
          {index === 0 ? 'Al inscribir' : `Después de ${step.wait || 'la espera'}`}
          {reply ? ' · responde en el mismo hilo' : ''}
        </span>
      </div>
      {!reply && <p className="text-[14px] text-ob-text">{step.subject || 'Sin asunto'}</p>}
      <HtmlPreview
        html={sanitizeEmailHtml(step.html)}
        title={`Vista previa del email ${index + 1}`}
      />
    </section>
  )
}
