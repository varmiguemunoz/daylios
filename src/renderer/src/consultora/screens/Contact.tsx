import { useCallback, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { ContactInput } from '@shared/consultora'
import { api, attempt, dateTime, useLoad, type Go } from '../lib'
import {
  EditableText,
  Empty,
  ErrorNote,
  Field,
  List,
  MarkdownField,
  MeetingStatusPill,
  Page,
  Row,
  Section,
  Select
} from '../ui'

/** Ficha de contacto: datos, empresa (cliente o prospecto), notas y reuniones donde aparece. */
export function Contact({
  id,
  go,
  back,
  backLabel
}: {
  id: string
  go: Go
  back: () => void
  backLabel: string
}): React.JSX.Element {
  const load = useCallback(() => api.getContact(id), [id])
  const { data: c, error: loadError } = useLoad(load)
  const refsLoad = useCallback(() => api.refs(), [])
  const { data: refs } = useLoad(refsLoad)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = async (patch: ContactInput): Promise<void> => setError(await attempt(() => api.updateContact(id, patch)))

  if (loadError?.includes('No existe ese contacto')) {
    return (
      <Page back={{ label: backLabel, onClick: back }} title="Contacto no disponible">
        <p className="mt-4 text-caption text-milk-soft">Este contacto ya no existe.</p>
      </Page>
    )
  }
  if (!c)
    return (
      <Page back={{ label: backLabel, onClick: back }} title="…">
        <ErrorNote message={loadError} />
      </Page>
    )

  const remove = async (): Promise<void> => {
    if (!confirmDelete) return setConfirmDelete(true)
    const failed = await attempt(() => api.removeContact(id))
    if (failed) setError(failed)
    else back()
  }

  const input = 'bg-transparent text-list outline-none'
  const text = (field: 'role' | 'email' | 'phone' | 'linkedin', label: string, placeholder: string): React.JSX.Element => (
    <Field label={label}>
      <input
        key={`${field}-${c[field]}`}
        defaultValue={c[field] ?? ''}
        placeholder={placeholder}
        onBlur={(e) => e.target.value !== (c[field] ?? '') && void save({ [field]: e.target.value } as ContactInput)}
        spellCheck={false}
        className={input}
      />
    </Field>
  )

  return (
    <Page
      back={{ label: backLabel, onClick: back }}
      title={<EditableText value={c.name} label="Nombre" onSave={(name) => void save({ name })} />}
      meta={
        c.clientId ? (
          <button type="button" onClick={() => go({ name: 'client', id: c.clientId! })} className="font-bold text-milk hover:text-apricot">
            {c.organization}
          </button>
        ) : c.prospectId ? (
          <button type="button" onClick={() => go({ name: 'prospect', id: c.prospectId! })} className="font-bold text-milk hover:text-apricot">
            {c.organization} · prospecto
          </button>
        ) : (
          <span>Sin empresa</span>
        )
      }
      actions={
        <button
          type="button"
          onClick={() => void remove()}
          onMouseLeave={() => setConfirmDelete(false)}
          onBlur={() => setConfirmDelete(false)}
          aria-label={confirmDelete ? 'Confirmar: borrar contacto' : 'Borrar contacto'}
          className={`flex h-9 items-center justify-center rounded-full text-caption font-extrabold transition-colors ${
            confirmDelete ? 'bg-rose px-4 text-ink' : 'w-9 text-milk-soft hover:bg-rose/15 hover:text-rose'
          }`}
        >
          {confirmDelete ? '¿Borrar?' : <Trash2 size={16} />}
        </button>
      }
    >
      <ErrorNote message={error} />

      <div className="mt-6 grid grid-cols-2 gap-2">
        {text('role', 'Rol', 'CTO, dueño, compras…')}
        {text('email', 'Email', 'nombre@empresa.com')}
        {text('phone', 'Teléfono', '+1 …')}
        {text('linkedin', 'LinkedIn', 'linkedin.com/in/…')}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Select
          label="Cliente"
          value={c.clientId ?? ''}
          options={[{ value: '', label: 'Sin cliente' }, ...(refs?.clients ?? []).map((x) => ({ value: x.id, label: x.name }))]}
          onChange={(client) => void save({ client })}
        />
        <Select
          label="Prospecto"
          value={c.prospectId ?? ''}
          options={[{ value: '', label: 'Sin prospecto' }, ...(refs?.prospects ?? []).map((x) => ({ value: x.id, label: x.company }))]}
          onChange={(prospect) => void save({ prospect })}
        />
      </div>

      <Section title="Notas">
        <MarkdownField
          value={c.notesMd}
          placeholder="Cómo prefiere comunicarse, qué le importa, historia con nosotros…"
          onSave={(notesMd) => void save({ notesMd })}
        />
      </Section>

      <Section title="Reuniones">
        {c.meetings.length === 0 ? (
          <Empty title="Sin reuniones." hint="Aparecen las reuniones donde figura como participante." />
        ) : (
          <List>
            {c.meetings.map((m) => (
              <Row key={m.id} onClick={() => go({ name: 'meeting', id: m.id })}>
                <span className="min-w-0 flex-1 truncate text-list font-bold">{m.title}</span>
                <MeetingStatusPill status={m.status} />
                <span className="shrink-0 text-caption text-milk-soft">{dateTime(m.date)}</span>
              </Row>
            ))}
          </List>
        )}
      </Section>
    </Page>
  )
}
