import { Modal } from '../../../ui'
import { Button } from '../../ui'

/** Al borrar un grupo con contenido: Obsidian solo quita el marco; aquí se puede elegir. */
export function GroupDeleteModal({
  count,
  onCancel,
  onGroupOnly,
  onAll
}: {
  count: number
  onCancel: () => void
  onGroupOnly: () => void
  onAll: () => void
}): React.JSX.Element {
  return (
    <Modal
      open
      size="sm"
      title="Borrar grupo"
      onClose={onCancel}
      actions={
        <>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button onClick={onGroupOnly}>Solo el grupo</Button>
          <Button kind="danger" onClick={onAll}>
            Grupo y contenido
          </Button>
        </>
      }
    >
      <p className="text-list">
        El grupo contiene {count} {count === 1 ? 'elemento' : 'elementos'}. Puedes quitar solo el
        marco o borrarlo todo. Se puede deshacer con ⌘Z.
      </p>
    </Modal>
  )
}
