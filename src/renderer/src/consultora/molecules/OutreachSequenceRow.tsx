import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { OutreachSequence } from '@shared/marketing'
import { Button, Pill, Row } from '../ui'

export function OutreachSequenceRow({
  sequence,
  busy,
  onToggle,
  onOpen
}: {
  sequence: OutreachSequence
  busy: boolean
  onToggle: (enabled: boolean) => void
  onOpen: () => void
}): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const activate = (): void => {
    if (!confirming) return setConfirming(true)
    setConfirming(false)
    onToggle(true)
  }
  return (
    <Row>
      <span className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className="block max-w-full truncate text-left text-list font-medium hover:text-ob-link"
        >
          {sequence.name}
        </button>
        <span className="block truncate text-caption text-ob-muted">
          {sequence.emails} {sequence.emails === 1 ? 'email' : 'emails'}
          {confirming && ' · Activarla envía correos reales desde tus buzones'}
        </span>
      </span>
      <Pill tone={sequence.enabled ? 'mint' : 'neutral'}>
        {sequence.enabled ? 'Activa' : 'Pausada'}
      </Pill>
      {sequence.enabled ? (
        <Button onClick={() => onToggle(false)} disabled={busy}>
          Pausar
        </Button>
      ) : (
        <>
          {confirming && <Button onClick={() => setConfirming(false)}>Cancelar</Button>}
          <Button kind={confirming ? 'primary' : 'quiet'} onClick={activate} disabled={busy}>
            {confirming ? 'Confirmar activación' : 'Activar'}
          </Button>
        </>
      )}
      <a
        href={sequence.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Abrir ${sequence.name} en el proveedor`}
        title="Abrir en el proveedor"
        className="grid size-7 shrink-0 place-items-center rounded-[4px] text-ob-muted hover:bg-ob-border hover:text-ob-text"
      >
        <ExternalLink size={15} />
      </a>
    </Row>
  )
}
