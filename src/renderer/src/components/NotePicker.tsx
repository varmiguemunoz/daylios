import { useEffect, useMemo, useState } from 'react'
import { normalizeName } from '@shared/consultora'
import type { NoteBrief, NoteTarget } from '@shared/notes'
import { notesApi } from '../lib/api'
import { Modal, SearchField, SegmentedToggle } from '../ui'

interface NotePickerProps {
  open: boolean
  /** La nota que se está relacionando (no aparece en la lista). */
  noteId: string
  /** Ya relacionadas (no se ofrecen otra vez). */
  exclude: string[]
  onPick: (target: NoteTarget) => void
  onClose: () => void
  /** Solo notas (p. ej. relacionar una nota desde la ficha de un cliente). */
  notesOnly?: boolean
}

type Kind = 'note' | 'client'

/** Elegir con qué relacionar una nota: otra nota (buscador) o un cliente. */
export function NotePicker({
  open,
  noteId,
  exclude,
  onPick,
  onClose,
  notesOnly = false
}: NotePickerProps): React.JSX.Element | null {
  const [chosen, setKind] = useState<Kind>('note')
  const kind: Kind = notesOnly ? 'note' : chosen
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState<NoteBrief[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (!open || kind !== 'note') return
    const t = setTimeout(() => {
      notesApi.search(query, 30).then(setNotes).catch(() => setNotes([]))
    }, 150)
    return () => clearTimeout(t)
  }, [open, kind, query])

  useEffect(() => {
    if (!open || kind !== 'client') return
    window.api.consultora
      .refs()
      .then((r) => setClients(r.clients.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => setClients([]))
  }, [open, kind])

  const skip = useMemo(() => new Set([noteId, ...exclude]), [noteId, exclude])
  const items =
    kind === 'note'
      ? notes.filter((n) => !skip.has(n.id)).map((n) => ({ id: n.id, title: n.title, hint: n.excerpt }))
      : clients
          .filter((c) => !skip.has(c.id) && (!query || normalizeName(c.name).includes(normalizeName(query))))
          .map((c) => ({ id: c.id, title: c.name, hint: '' }))

  const pick = (id: string): void => {
    onPick({ type: kind, id })
    setQuery('')
  }

  return (
    <Modal open={open} title={notesOnly ? 'Relacionar nota' : 'Relacionar'} onClose={onClose} size="sm">
      <div className="flex flex-col gap-3">
        {!notesOnly && (
          <SegmentedToggle
            label="Relacionar con"
            value={kind}
            options={[
              { id: 'note', label: 'Nota' },
              { id: 'client', label: 'Cliente' }
            ]}
            onChange={setKind}
          />
        )}
        <div className="flex">
          <SearchField
            value={query}
            onChange={setQuery}
            autoFocus
            placeholder={kind === 'note' ? 'Título o texto de la nota' : 'Nombre del cliente'}
            onEnter={() => items[0] && pick(items[0].id)}
          />
        </div>
        <ul className="overflow-hidden rounded-md bg-night/40 [&>li+li]:shadow-[inset_0_1px_0_var(--color-hairline)]">
          {items.length === 0 && (
            <li className="px-4 py-3 text-caption text-milk-soft">
              {kind === 'note' ? 'Ninguna nota coincide.' : 'Ningún cliente coincide.'}
            </li>
          )}
          {items.slice(0, 30).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => pick(item.id)}
                className="w-full px-4 py-2.5 text-left transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised"
              >
                <span className="block truncate text-list font-bold">{item.title}</span>
                {item.hint && <span className="block truncate text-caption text-milk-soft">{item.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
