import { useState } from 'react'
import { Button, ErrorNote } from '../../ui'
import { Modal } from '../../../ui'

interface NameModalProps {
  title: string
  label: string
  initial?: string
  confirmLabel: string

  onSubmit: (name: string) => Promise<string | null>
  onClose: () => void
}

export function NameModal({
  title,
  label,
  initial = '',
  confirmLabel,
  onSubmit,
  onClose
}: NameModalProps): React.JSX.Element {
  const [name, setName] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    if (!name.trim() || busy) return
    setBusy(true)
    const failed = await onSubmit(name.trim())
    setBusy(false)
    if (failed) setError(failed)
    else onClose()
  }

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      size="sm"
      actions={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button kind="primary" onClick={() => void submit()} disabled={!name.trim() || busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <label className="block">
        <span className="text-micro font-medium text-ob-muted">{label}</span>
        <input
          autoFocus
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => {
            // Selecciona el nombre sin la extensión, como Finder.
            const dot = e.currentTarget.value.lastIndexOf('.')
            e.currentTarget.setSelectionRange(0, dot > 0 ? dot : e.currentTarget.value.length)
          }}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          className="mt-1.5 h-8 w-full px-2.5 text-[14px] rounded-[4px] border border-ob-border bg-ob-bg text-ob-text outline-none placeholder:text-ob-faint focus:border-ob-accent"
        />
      </label>
      <ErrorNote message={error} />
    </Modal>
  )
}
