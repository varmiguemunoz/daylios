import { useCallback, useState } from 'react'
import {
  Briefcase,
  CalendarDays,
  Check,
  Film,
  FolderKanban,
  Languages,
  Sparkles,
  SquareKanban,
  Users,
  X
} from 'lucide-react'
import type { ActionItem, MeetingInput } from '@shared/consultora'
import { api, attempt, dateTime, duration, openPath, useLoad } from '../lib'
import {
  Button,
  ConfirmButton,
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
import { useGoneRedirect, useScreenTitle } from '../chrome'
import { Properties, PropertyRow } from '../molecules/Properties'
import { Authorship } from '../organisms/orgs/Authorship'
import { AssigneeRow } from '../organisms/orgs/AssigneeRow'
import { EntityActivity } from '../organisms/activity/EntityActivity'

export function Meeting({ id, back }: { id: string; back: () => void }): React.JSX.Element {
  const load = useCallback(() => api.getMeeting(id), [id])
  const { data: m, error: loadError } = useLoad(load)
  useScreenTitle(m?.title)
  useGoneRedirect(loadError)
  const refsLoad = useCallback(() => api.refs(), [])
  const { data: refs } = useLoad(refsLoad)
  const [error, setError] = useState<string | null>(null)
  const [newItem, setNewItem] = useState('')

  const save = async (patch: MeetingInput): Promise<void> =>
    setError(await attempt(() => api.updateMeeting(id, patch)))
  const saveItems = (items: ActionItem[]): Promise<void> => save({ actionItems: items })

  // Borrada (desde aquí, otra pantalla o Claude): no reintentar cargarla.
  if (loadError?.includes('No existe esa reunión')) {
    return (
      <Page variant="document" title="Reunión no disponible">
        <p className="mt-4 text-caption text-ob-muted">Esta reunión ya no existe.</p>
      </Page>
    )
  }
  if (!m)
    return (
      <Page variant="document" title="…">
        <ErrorNote message={loadError} />
      </Page>
    )

  const busy = m.status === 'transcribing' || m.status === 'summarizing' || m.status === 'recording'
  const canSummarize =
    !busy && Boolean(m.transcriptMd.trim() || m.rawNotesMd.trim() || m.recordingPath)
  const projects = refs?.projects.filter((p) => !m.clientId || p.clientId === m.clientId) ?? []

  const remove = async (): Promise<void> => {
    const failed = await attempt(() => api.removeMeeting(id))
    if (failed) setError(failed)
    else back()
  }

  return (
    <Page
      variant="document"
      title={
        <EditableText value={m.title} label="Título" onSave={(title) => void save({ title })} />
      }
      meta={m.status !== 'ready' ? <MeetingStatusPill status={m.status} /> : undefined}
      actions={
        <>
          {m.recordingPath && (
            <Button
              onClick={() => void openPath(m.recordingPath!).catch((e) => setError(String(e)))}
              title={m.recordingPath}
            >
              <Film size={15} />
              Grabación
            </Button>
          )}
          <Button
            kind="primary"
            disabled={!canSummarize}
            onClick={() => void attempt(() => api.processMeeting(id)).then(setError)}
            title="Transcribe (si falta) y genera resumen, decisiones y action items. Reemplaza los actuales."
          >
            <Sparkles size={15} />
            {m.status === 'error' ? 'Reintentar' : m.summaryMd ? 'Resumir de nuevo' : 'Resumir'}
          </Button>
          <ConfirmButton label="Borrar reunión" onConfirm={() => void remove()} />
        </>
      }
    >
      {busy && m.status !== 'recording' && (
        <p className="mt-4 rounded-[6px] border-l-2 border-ob-accent bg-ob-accent/10 px-3 py-2 text-caption text-ob-link">
          {m.status === 'transcribing' ? 'Transcribiendo la grabación…' : 'Generando el resumen…'}{' '}
          Puedes cerrar esta pantalla; te aviso al terminar.
        </p>
      )}
      {m.status === 'error' && m.error && (
        <p className="mt-4 rounded-[6px] border-l-2 border-ob-red bg-ob-red/10 px-3 py-2 text-[13px] text-ob-red">
          {m.error}
        </p>
      )}
      <ErrorNote message={error ?? loadError} />

      <Properties id="meeting">
        <PropertyRow icon={CalendarDays} label="Fecha">
          <span className="block px-1.5 text-[14px] text-ob-text">
            {dateTime(m.date)}
            {m.durationSec ? (
              <span className="text-ob-muted"> · {duration(m.durationSec)}</span>
            ) : null}
          </span>
        </PropertyRow>
        <PropertyRow icon={Briefcase} label="Cliente">
          <Select
            label="Cliente"
            value={m.clientId ?? ''}
            options={[
              { value: '', label: 'Sin cliente' },
              ...(refs?.clients ?? []).map((c) => ({ value: c.id, label: c.name }))
            ]}
            onChange={(client) => void save({ client, project: '' })}
          />
        </PropertyRow>
        <PropertyRow icon={FolderKanban} label="Proyecto">
          <Select
            label="Proyecto"
            value={m.projectId ?? ''}
            options={[
              { value: '', label: 'Sin proyecto' },
              ...projects.map((p) => ({ value: p.id, label: p.name }))
            ]}
            onChange={(project) => void save({ project })}
          />
        </PropertyRow>
        <PropertyRow icon={SquareKanban} label="Prospecto">
          <Select
            label="Prospecto"
            value={m.prospectId ?? ''}
            options={[
              { value: '', label: 'Sin prospecto' },
              ...(refs?.prospects ?? []).map((p) => ({ value: p.id, label: p.company }))
            ]}
            onChange={(prospect) => void save({ prospect })}
          />
        </PropertyRow>
        <PropertyRow icon={Users} label="Participantes">
          <span className="block text-[14px]">
            <EditableText
              value={m.participants.join(', ')}
              placeholder="Ana (Acme), Miguel…"
              label="Participantes separados por comas"
              onSave={(text) =>
                void save({
                  participants: text
                    .split(',')
                    .map((p) => p.trim())
                    .filter(Boolean)
                })
              }
            />
          </span>
        </PropertyRow>
        <div className="pl-[min(160px,30%)]">
          <ContactChips
            clientId={m.clientId}
            prospectId={m.prospectId}
            current={m.participants}
            onAdd={(name) => void save({ participants: [...m.participants, name] })}
          />
        </div>
        {m.recordingPath && (
          <PropertyRow icon={Languages} label="Idioma">
            <span className="flex items-center gap-2">
              <Select
                label="Idioma hablado"
                value={m.language ?? ''}
                options={[
                  { value: '', label: 'Detectar' },
                  { value: 'es', label: 'Español' },
                  { value: 'en', label: 'English' }
                ]}
                onChange={(language) =>
                  void save({ language: (language || null) as MeetingInput['language'] })
                }
              />
              <span className="truncate text-[12px] text-ob-faint">Se usa al transcribir.</span>
            </span>
          </PropertyRow>
        )}
        <AssigneeRow value={m.assigneeId} onChange={(assigneeId) => void save({ assigneeId })} />
      </Properties>
      <Authorship table="meetings" id={m.id} />

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
                  className={`grid size-5 shrink-0 place-items-center rounded-[4px] transition-[background-color,box-shadow] ${
                    item.done
                      ? 'bg-ob-accent text-white'
                      : 'shadow-[inset_0_0_0_1.5px_var(--color-ob-faint)] hover:shadow-[inset_0_0_0_1.5px_var(--color-ob-accent)]'
                  }`}
                >
                  {item.done && <Check size={12} strokeWidth={3} />}
                </button>
                <span
                  className={`min-w-0 flex-1 text-list ${item.done ? 'text-ob-muted line-through decoration-ob-muted/50' : ''}`}
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
                  className="grid size-7 shrink-0 place-items-center rounded-[4px] text-ob-muted hover:bg-ob-red/15 hover:text-ob-red"
                >
                  <X size={14} />
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
                className="h-8 w-full bg-transparent px-2 text-[14px] outline-none placeholder:text-ob-faint"
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
          <details className="group rounded-[6px] border border-ob-border px-4 py-3">
            <summary className="cursor-pointer text-caption font-medium text-ob-muted">
              {m.transcriptMd.length.toLocaleString('es-ES')} caracteres · mostrar
            </summary>
            <p className="mt-3 text-list leading-relaxed whitespace-pre-wrap text-ob-muted select-text">
              {m.transcriptMd}
            </p>
          </details>
        </Section>
      )}
      <EntityActivity entity="meetings" id={id} />
    </Page>
  )
}
