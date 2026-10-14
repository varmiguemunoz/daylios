import { useEffect, useState } from 'react'
import type { DeleteImpact, WorkspaceItem } from '@shared/workspace'
import { Button, ErrorNote } from '../../ui'
import { Modal } from '../../../ui'
import { attempt } from '../../lib'
import { KIND_LABEL, ws } from '../lib'

interface DeleteItemModalProps {
  item: WorkspaceItem
  onClose: () => void
  onDeleted: () => void
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** Borrar: dice qué se pierde y qué enlaces quedan rotos. Todo va a la Papelera (recuperable). */
export function DeleteItemModal({
  item,
  onClose,
  onDeleted
}: DeleteItemModalProps): React.JSX.Element {
  const [impact, setImpact] = useState<DeleteImpact | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ws.impact(item.id)
      .then(setImpact)
      .catch(() => setImpact(null))
  }, [item.id])

  const confirm = async (): Promise<void> => {
    setBusy(true)
    const failed = await attempt(() => ws.remove(item.id))
    setBusy(false)
    if (failed) return setError(failed)
    onDeleted()
  }

  const inside =
    impact && item.kind === 'folder'
      ? [
          impact.folders - 1 > 0 && plural(impact.folders - 1, 'subcarpeta', 'subcarpetas'),
          impact.notes > 0 && plural(impact.notes, 'nota', 'notas'),
          impact.boards > 0 && plural(impact.boards, 'board', 'boards'),
          impact.files > 0 && plural(impact.files, 'archivo', 'archivos')
        ].filter(Boolean)
      : []

  return (
    <Modal
      open
      title={`Borrar «${item.name}»`}
      onClose={onClose}
      size="sm"
      actions={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy || !impact}
            className="flex h-[30px] items-center rounded-[4px] bg-ob-red px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#e03a40] disabled:pointer-events-none disabled:opacity-40"
          >
            {busy ? 'Moviendo…' : 'Mover a la Papelera'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2 text-list">
        {item.kind === 'folder' ? (
          <p>
            {inside.length ? `La carpeta contiene ${inside.join(', ')}.` : 'La carpeta está vacía.'}
          </p>
        ) : (
          <p>
            {KIND_LABEL[item.kind]} «{item.name}».
          </p>
        )}
        {impact && impact.referencedBy > 0 && (
          <p className="rounded-[6px] border-l-2 border-ob-yellow bg-ob-yellow/10 px-3 py-2 text-caption text-ob-yellow">
            {plural(impact.referencedBy, 'nota o board la usa', 'notas o boards la usan')}: sus
            enlaces quedarán rotos.
          </p>
        )}
        <p className="text-caption text-ob-muted">
          Va a la Papelera de macOS: puedes recuperarlo desde Finder.
        </p>
      </div>
      <ErrorNote message={error} />
    </Modal>
  )
}
