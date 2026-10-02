import { useCallback, useState } from 'react'
import { Check, Film, Sparkles, Trash2, X } from 'lucide-react'
import type { ActionItem, MeetingInput } from '@shared/consultora'
import { api, attempt, dateTime, duration, openPath, useLoad } from '../lib'
import {
  Button,
  EditableText,
  ErrorNote,
  List,
  MarkdownField,
  MeetingStatusPill,
  Page,
  Row,
  Section,
  Select
} from '../ui'
import { ContactChips } from '../MeetingSheet'

/**
 * Detalle de reunión: resumen, decisiones, action items, asociación, notas crudas y transcripción.
 * Todo lo que generó el modelo se puede editar a mano.
 */
export function Meeting({
  id,
  back,
  backLabel
}: {
  id: string
  back: () => void
  backLabel: string
}): React.JSX.Element {
  const load = useCallback(() => api.getMeeting(id), [id])
  const { data: m, error: loadError } = useLoad(load)
  const refsLoad = useCallback(() => api.refs(), [])
  const { data: refs } = useLoad(refsLoad)
  const [error, setError] = useState<string | null>(null)
  const [newItem, setNewItem] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = async (patch: MeetingInput): Promise<void> =>
    setError(await attempt(() => api.updateMeeting(id, patch)))
  const saveItems = (items: ActionItem[]): Promise<void> => save({ actionItems: items })

  // Borrada (desde aquí, otra pantalla o Claude): no reintentar cargarla.
  if (loadError?.includes('No existe esa reunión')) {
    return (
      <Page back={{ label: backLabel, onClick: back }} title="Reunión no disponible">
        <p className="mt-4 text-caption text-milk-soft">Esta reunión ya no existe.</p>
      </Page>
    )
  }
  if (!m)
    return (
      <Page back={{ label: backLabel, onClick: back }} title="…">
        <ErrorNote message={loadError} />
      </Page>
    )

  const busy = m.status === 'transcribing' || m.status === 'summarizing' || m.status === 'recording'
  const canSummarize =
    !busy && Boolean(m.transcriptMd.trim() || m.rawNotesMd.trim() || m.recordingPath)
  const projects = refs?.projects.filter((p) => !m.clientId || p.clientId === m.clientId) ?? []

  const remove = async (): Promise<void> => {
    if (!confirmDelete) return setConfirmDelete(true)
    const failed = await attempt(() => api.removeMeeting(id))
    if (failed) setError(failed)
    else back()
  }

  return (
    <Page
      back={{ label: backLabel, onClick: back }}
      title={
        <EditableText value={m.title} label="Título" onSave={(title) => void save({ title })} />
      }
      meta={
        <>
          <span>{dateTime(m.date)}</span>
          {m.durationSec ? <span>· {duration(m.durationSec)}</span> : null}
          <MeetingStatusPill status={m.status} />
        </>
      }
      actions={
        <>
          {m.recordingPath && (
            <Button
              onClick={() => void openPath(m.recordingPath!).catch((e) => setError(String(e)))}
              title={m.recordingPath}
            >
              <Film size={15} strokeWidth={2.5} />
              Grabación
            </Button>
          )}
          <Button
            kind="primary"
            disabled={!canSummarize}
            onClick={() => void attempt(() => api.processMeeting(id)).then(setError)}
            title="Transcribe (si falta) y genera resumen, decisiones y action items. Reemplaza los actuales."
          >
            <Sparkles size={15} strokeWidth={2.5} />
            {m.status === 'error' ? 'Reintentar' : m.summaryMd ? 'Resumir de nuevo' : 'Resumir'}
          </Button>
          <button
            type="button"
            onClick={() => void remove()}
            onMouseLeave={() => setConfirmDelete(false)}
            onBlur={() => setConfirmDelete(false)}
            aria-label={confirmDelete ? 'Confirmar: borrar reunión' : 'Borrar reunión'}
            className={`flex h-9 items-center justify-center rounded-full text-caption font-extrabold transition-colors ${
              confirmDelete
                ? 'bg-rose px-4 text-ink'
                : 'w-9 text-milk-soft hover:bg-rose/15 hover:text-rose'
            }`}
          >
            {confirmDelete ? '¿Borrar?' : <Trash2 size={16} />}
          </button>
        </>
      }
    >
      {busy && m.status !== 'recording' && (
        <p className="mt-4 rounded-md bg-apricot/10 px-4 py-3 text-caption text-apricot">
          {m.status === 'transcribing' ? 'Transcribiendo la grabación…' : 'Generando el resumen…'}{' '}
          Puedes cerrar esta pantalla; te aviso al terminar.
        </p>
      )}
      {m.status === 'error' && m.error && (
        <p className="mt-4 rounded-md bg-coral/12 px-4 py-3 text-caption text-coral">{m.error}</p>
      )}
      <ErrorNote message={error ?? loadError} />

      {/* Asociación */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Select
          label="Cliente"
          value={m.clientId ?? ''}
          options={[
            { value: '', label: 'Sin cliente' },
            ...(refs?.clients ?? []).map((c) => ({ value: c.id, label: c.name }))
          ]}
          onChange={(client) => void save({ client, project: '' })}
        />
        <Select
          label="Proyecto"
          value={m.projectId ?? ''}
          options={[
            { value: '', label: 'Sin proyecto' },
            ...projects.map((p) => ({ value: p.id, label: p.name }))
          ]}
          onChange={(project) => void save({ project })}
        />
        <Select
          label="Prospecto"
          value={m.prospectId ?? ''}
          options={[
            { value: '', label: 'Sin prospecto' },
            ...(refs?.prospects ?? []).map((p) => ({ value: p.id, label: p.company }))
          ]}
          onChange={(prospect) => void save({ prospect })}
        />
      </div>
      <div className="mt-3 flex items-center gap-2 text-caption">
        <span className="shrink-0 font-bold text-milk-soft">Participantes</span>
        <EditableText
          value={m.participants.join(', ')}
          placeholder="Ana (Acme), Miguel…"
          label="Participantes separados por comas"
          className="text-caption"
          onSave={(text) =>
            void save({
              participants: text
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean)
            })
          }
        />
      </div>
      <div className="mt-2">
        <ContactChips
          clientId={m.clientId}
          prospectId={m.prospectId}
          current={m.participants}
          onAdd={(name) => void save({ participants: [...m.participants, name] })}
        />
      </div>
      {m.recordingPath && (
        <div className="mt-3 flex items-center gap-2 text-caption">
          <span className="shrink-0 font-bold text-milk-soft">Idioma de la reunión</span>
          <Select
            label="Idioma hablado"
            value={m.language ?? ''}
            options={[
              { value: '', label: 'Detectar' },
              { value: 'es', label: 'Español' },
              { value: 'en', label: 'English' }
            ]}
            onChange={(language) => void save({ language: (language || null) as MeetingInput['language'] })}
          />
          <span className="text-milk-soft">Se usa al transcribir (también al reintentar).</span>
        </div>
      )}

      <Section title="Resumen ejecutivo">
        <MarkdownField
          value={m.summaryMd}
          placeholder="Se genera al procesar, o escríbelo tú."
          onSave={(summaryMd) => void save({ summaryMd })}
        />
      </Section>

      <Section title="Decisiones">
        <MarkdownField
          value={m.decisionsMd}
          placeholder="- Qué se decidió"
          onSave={(decisionsMd) => void save({ decisionsMd })}
        />
      </Section>

      <Section title="Action items">
        <List>
          {m.actionItems.map((item, i) => {
            const set = (patch: Partial<ActionItem>): void =>
              void saveItems(m.actionItems.map((it, j) => (j === i ? { ...it, ...patch } : it)))
            return (
              <Row key={i}>
                <button
                  type="button"
                  aria-label={item.done ? 'Marcar pendiente' : 'Marcar hecho'}
                  onClick={() => set({ done: !item.done })}
                  className={`grid size-5 shrink-0 place-items-center rounded-full transition-[background-color,box-shadow] ${
                    item.done
                      ? 'bg-mint text-ink'
                      : 'shadow-[inset_0_0_0_1.5px_var(--color-milk-faint)] hover:shadow-[inset_0_0_0_1.5px_var(--color-apricot)]'
                  }`}
                >
                  {item.done && <Check size={12} strokeWidth={3.5} />}
                </button>
                <span
                  className={`min-w-0 flex-1 text-list ${item.done ? 'text-milk-soft line-through decoration-milk-soft/50' : ''}`}
                >
                  <EditableText
                    value={item.text}
                    label="Tarea"
                    onSave={(text) => text && set({ text })}
                  />
                </span>
                <span className="w-32 shrink-0 text-caption">
                  <EditableText
                    value={item.owner ?? ''}
                    placeholder="Responsable"
                    label="Responsable"
                    onSave={(owner) => set({ owner: owner || null })}
                  />
                </span>
                <span className="w-28 shrink-0 text-caption">
                  <EditableText
                    value={item.due ?? ''}
                    placeholder="Fecha"
                    label="Fecha límite"
                    onSave={(due) => set({ due: due || null })}
                  />
                </span>
                <button
                  type="button"
                  aria-label="Quitar"
                  onClick={() => void saveItems(m.actionItems.filter((_, j) => j !== i))}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-milk-soft hover:bg-rose/15 hover:text-rose"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </Row>
            )
          })}
          <li>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!newItem.trim()) return
                void saveItems([
                  ...m.actionItems,
                  { text: newItem.trim(), owner: null, due: null, done: false }
                ])
                setNewItem('')
              }}
            >
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Añadir action item y Enter"
                aria-label="Nuevo action item"
                className="h-11 w-full bg-transparent px-4 text-list outline-none placeholder:text-milk-soft"
              />
            </form>
          </li>
        </List>
      </Section>

      <Section title="Notas crudas">
        <MarkdownField
          value={m.rawNotesMd}
          placeholder="Apuntes durante la reunión. «Resumir» también los usa."
          onSave={(rawNotesMd) => void save({ rawNotesMd })}
        />
      </Section>

      {m.transcriptMd && (
        <Section title="Transcripción">
          <details className="group rounded-md bg-surface px-5 py-4">
            <summary className="cursor-pointer text-caption font-bold text-milk-soft">
              {m.transcriptMd.length.toLocaleString('es-ES')} caracteres · mostrar
            </summary>
            <p className="mt-3 text-list leading-relaxed whitespace-pre-wrap text-milk-soft select-text">
              {m.transcriptMd}
            </p>
          </details>
        </Section>
      )}
    </Page>
  )
}
