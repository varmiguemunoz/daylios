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

/** Borrar un cliente: impacto escrito, carpeta opcional a la Papelera y nombre para confirmar. */
export function DeleteClientModal({ open, client, onClose, onDeleted }: DeleteClientModalProps): React.JSX.Element | null {
  const [impact, setImpact] = useState<ClientImpact | null>(null)
  const [trash, setTrash] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    api.clientImpact(client.id).then(setImpact).catch(() => setImpact(null))
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
        impact.projects && `Se borran ${impact.projects} ${impact.projects === 1 ? 'proyecto' : 'proyectos'}.`,
        impact.meetings && `${impact.meetings} ${impact.meetings === 1 ? 'reunión queda' : 'reuniones quedan'} sin cliente.`,
        impact.contacts && `${impact.contacts} ${impact.contacts === 1 ? 'contacto queda' : 'contactos quedan'} sin empresa.`,
        impact.prospects && `${impact.prospects} ${impact.prospects === 1 ? 'prospecto pierde' : 'prospectos pierden'} el cliente.`,
        impact.notes && `${impact.notes} ${impact.notes === 1 ? 'nota pierde' : 'notas pierden'} la relación (no se borran).`
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
            className="flex h-9 items-center rounded-full bg-rose px-4 text-caption font-extrabold text-ink transition-transform active:scale-95 disabled:bg-surface-raised disabled:text-milk-faint"
          >
            {busy ? 'Borrando…' : 'Borrar cliente'}
          </button>
        </>
      }
    >
      <ul className="flex flex-col gap-1 text-list">
        {lines.length ? lines.map((l) => <li key={String(l)}>{l}</li>) : <li>Sin proyectos, reuniones ni contactos.</li>}
      </ul>
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-md bg-night/40 px-4 py-3 text-caption">
        <input type="checkbox" checked={trash} onChange={(e) => setTrash(e.target.checked)} className="mt-0.5 accent-[var(--color-rose)]" />
        <span className="min-w-0 flex-1">
          Mover también la carpeta a la Papelera
          <span className="block truncate text-milk-soft" title={impact?.folderPath}>
            {impact?.folderPath ?? '…'}
          </span>
          {!trash && <span className="block text-milk-soft">Si no la marcas, la carpeta se queda en tu disco.</span>}
        </span>
      </label>
      <label className="mt-4 block text-caption text-milk-soft">
        Escribe <span className="font-bold text-milk">{client.name}</span> para confirmar
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void confirm()}
          aria-label="Nombre del cliente para confirmar"
          className="mt-1.5 h-11 w-full rounded-sm bg-night/60 px-4 text-list text-milk outline-none focus:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-rose)_70%,transparent)]"
        />
      </label>
      <ErrorNote message={error} />
    </Modal>
  )
}
