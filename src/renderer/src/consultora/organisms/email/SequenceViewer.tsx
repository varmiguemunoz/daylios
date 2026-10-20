import { useState } from 'react'
import type { OutreachSequenceDetail } from '@shared/marketing'
import { Button, Pill } from '../../ui'
import { StepPreview } from '../../molecules/StepPreview'

export function SequenceViewer({
  sequence,
  busy,
  onEdit,
  onArchive
}: {
  sequence: OutreachSequenceDetail
  busy: boolean
  onEdit: () => void
  onArchive: () => void
}): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={sequence.enabled ? 'mint' : 'neutral'}>
          {sequence.enabled ? 'Activa' : 'Pausada'}
        </Pill>
        <span className="text-caption text-ob-muted">
          {sequence.steps.length} {sequence.steps.length === 1 ? 'email' : 'emails'}
        </span>
        <span className="flex-1" />
        {confirming ? (
          <>
            <span className="text-caption text-ob-red">
              Se archiva en Apollo y termina a todos sus inscritos.
            </span>
            <Button onClick={() => setConfirming(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button kind="danger" onClick={onArchive} disabled={busy}>
              Confirmar eliminación
            </Button>
          </>
        ) : (
          <>
            <Button kind="danger" onClick={() => setConfirming(true)} disabled={busy}>
              Eliminar
            </Button>
            <Button kind="primary" onClick={onEdit} disabled={busy}>
              Editar
            </Button>
          </>
        )}
      </div>
      {sequence.steps.map((step, i) => (
        <StepPreview key={step.id ?? i} step={step} index={i} />
      ))}
    </div>
  )
}
