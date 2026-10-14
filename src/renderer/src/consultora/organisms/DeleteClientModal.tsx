import { useEffect, useState } from 'react'
import type { ClientImpact } from '@shared/consultora'
import { api, attempt } from '../lib'
import { Button, ErrorNote, Modal } from '../ui'

interface DeleteClientModalProps {
  open: boolean
  client: { id: string; name: string }
  onClose: () => void
  onDeleted: () => void
}

export function DeleteClientModal({
  open,
  client,
  onClose,
  onDeleted
}: DeleteClientModalProps): React.JSX.Element | null {
  const [impact, setImpact] = useState<ClientImpact | null>(null)
  const [trash, setTrash] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    api
      .clientImpact(client.id)
      .then(setImpact)
      .catch(() => setImpact(null))
  }, [open, client.id])

  const matches = typed.trim().toLowerCase() === client.name.trim().toLowerCase()

  const confirm = async (): Promise<void> => {
    if (!matches || busy) return
    setBusy(true)
    const failed = await attempt(() => api.removeClient(client.id, { trashFolder: trash }))
    setBusy(false)
    if (failed) return setError(failed)
    onDeleted()
  }

  const lines = impact
    ? [
        impact.projects &&
          `Se borran ${impact.projects} ${impact.projects === 1 ? 'proyecto' : 'proyectos'}.`,
        impact.meetings &&
          `${impact.meetings} ${impact.meetings === 1 ? 'reunión queda' : 'reuniones quedan'} sin cliente.`,
        impact.contacts &&
          `${impact.contacts} ${impact.contacts === 1 ? 'contacto queda' : 'contactos quedan'} sin empresa.`,
        impact.prospects &&
          `${impact.prospects} ${impact.prospects === 1 ? 'prospecto pierde' : 'prospectos pierden'} el cliente.`,
        impact.notes &&
          `${impact.notes} ${impact.notes === 1 ? 'nota pierde' : 'notas pierden'} la relación (no se borran).`
      ].filter(Boolean)
    : []

  return (
    <Modal
      open={open}
      title={`Borrar «${client.name}»`}
      onClose={onClose}
      size="sm"
      actions={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!matches || busy}
            className="flex h-[30px] items-center rounded-[4px] bg-ob-red px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#e03a40] disabled:pointer-events-none disabled:opacity-40"
          >
            {busy ? 'Borrando…' : 'Borrar cliente'}
          </button>
        </>
      }
    >
      <ul className="flex flex-col gap-1 text-list">
        {lines.length ? (
          lines.map((l) => <li key={String(l)}>{l}</li>)
        ) : (
          <li>Sin proyectos, reuniones ni contactos.</li>
        )}
      </ul>
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-[6px] border border-ob-border px-3 py-2.5 text-caption">
        <input
          type="checkbox"
          checked={trash}
          onChange={(e) => setTrash(e.target.checked)}
          className="mt-0.5 accent-[var(--color-ob-red)]"
        />
        <span className="min-w-0 flex-1">
          Mover también la carpeta a la Papelera
          <span className="block truncate text-ob-muted" title={impact?.folderPath}>
            {impact?.folderPath ?? '…'}
          </span>
          {!trash && (
            <span className="block text-ob-muted">
              Si no la marcas, la carpeta se queda en tu disco.
            </span>
          )}
        </span>
      </label>
      <label className="mt-4 block text-caption text-ob-muted">
        Escribe <span className="font-medium text-ob-text">{client.name}</span> para confirmar
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void confirm()}
          aria-label="Nombre del cliente para confirmar"
          className="mt-1.5 h-8 w-full rounded-[4px] border border-ob-border bg-ob-bg px-2.5 text-[14px] text-ob-text outline-none focus:border-ob-red"
        />
      </label>
      <ErrorNote message={error} />
    </Modal>
  )
}
