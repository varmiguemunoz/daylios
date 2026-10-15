import { useState } from 'react'
import type { SubjectOption, SubjectType } from '@shared/automations'
import { Modal } from '../../../ui'
import { attempt } from '../../lib'
import { Button, ErrorNote } from '../../ui'
import { SubjectPicker } from '../../molecules/automation/SubjectPicker'

const automations = window.api.automations

export function RunManualModal({
  open,
  id,
  subject,
  onClose
}: {
  open: boolean
  id: string
  subject: SubjectType
  onClose: () => void
}): React.JSX.Element {
  const [picked, setPicked] = useState<SubjectOption | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = async (): Promise<void> => {
    const failed = await attempt(() => automations.runManual(id, picked?.id ?? null))
    setError(failed)
    if (!failed) onClose()
  }
  return (
    <Modal
      open={open}
      title="Ejecutar ahora"
      onClose={onClose}
      size="sm"
      actions={
        <Button kind="primary" onClick={() => void run()} disabled={subject !== 'none' && !picked}>
          Ejecutar
        </Button>
      }
    >
      {subject === 'none' ? (
        <p className="text-[13px] text-ob-muted">Corre la versión publicada una vez, sin sujeto.</p>
      ) : (
        <SubjectPicker subject={subject} value={picked} onChange={setPicked} />
      )}
      <ErrorNote message={error} />
    </Modal>
  )
}
