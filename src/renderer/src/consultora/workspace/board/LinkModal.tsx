import { useState } from 'react'
import { Modal } from '../../../ui'
import { Button, INPUT } from '../../ui'
import { normalizeUrl } from './url'

export function LinkModal({
  onCancel,
  onAdd
}: {
  onCancel: () => void
  onAdd: (url: string) => void
}): React.JSX.Element {
  const [text, setText] = useState('')
  const url = normalizeUrl(text)
  const submit = (): void => {
    if (url) onAdd(url)
  }
  return (
    <Modal
      open
      size="sm"
      title="Añadir página web"
      onClose={onCancel}
      actions={
        <>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button kind="primary" onClick={submit} disabled={!url}>
            Añadir
          </Button>
        </>
      }
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        placeholder="https://"
        aria-label="Dirección de la página"
        className={INPUT}
      />
    </Modal>
  )
}
