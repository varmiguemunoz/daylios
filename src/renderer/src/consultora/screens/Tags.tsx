import { useCallback, useMemo, useState } from 'react'
import { Radio } from 'lucide-react'
import { normalizeName } from '@shared/consultora'
import type { TagSummary } from '@shared/marketing'
import type { TaskTagSummary } from '@shared/tasks'
import { attempt, useLoad } from '../lib'
import { ConfirmButton, EditableText, Empty, ErrorNote, List, Page, Row, SearchField, Section } from '../ui'
import { TagPill } from '../marketing-ui'

const marketing = window.api.marketing
const tasks = window.api.tasks

/**
 * Todos los tags: de contactos (con audiencia = Segment de Resend) y de tareas.
 * Renombrar en el sitio; borrar en dos pasos con su consecuencia escrita.
 */
export function Tags(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const contactLoad = useCallback(() => marketing.listTags(), [])
  const { data: contactTags, error: contactError } = useLoad(contactLoad)
  const taskLoad = useCallback(() => tasks.tagSummaries(), [])
  const { data: taskTags, error: taskError, reload: reloadTasks } = useLoad(taskLoad)

  const q = normalizeName(query)
  const contacts = useMemo(
    () =>
      [...(contactTags ?? [])]
        .filter((t) => !q || normalizeName(`${t.name} ${t.slug}`).includes(q))
        .sort((a, b) => b.contacts - a.contacts || a.name.localeCompare(b.name, 'es')),
    [contactTags, q]
  )
  const taskList = useMemo(
    () => (taskTags ?? []).filter((t) => !q || normalizeName(t.tag).includes(q)),
    [taskTags, q]
  )

  const run = async (fn: () => Promise<unknown>): Promise<void> => setError(await attempt(fn))

  return (
    <Page
      title="Tags"
      meta={
        contactTags &&
        taskTags && (
          <span>
            {contactTags.length} de contactos · {taskTags.length} de tareas
          </span>
        )
      }
    >
      <div className="mt-5 flex">
        <SearchField value={query} onChange={setQuery} placeholder="Buscar tag" label="Buscar tag" />
      </div>
      <ErrorNote message={error ?? contactError ?? taskError} />

      <Section title="Contactos">
        {contacts.length === 0 ? (
          <Empty title={q ? 'Ningún tag coincide.' : 'Aún no hay tags de contactos.'} />
        ) : (
          <List>
            {contacts.map((t) => (
              <ContactTagRow
                key={t.slug}
                tag={t}
                onRename={(name) => void run(() => marketing.renameTag(t.slug, name))}
                onAudience={(on) => void run(() => marketing.setTagAudience(t.slug, on))}
                onRemove={() => void run(() => marketing.removeTag(t.slug))}
              />
            ))}
          </List>
        )}
        <p className="mt-2 px-1 text-micro font-semibold text-milk-soft">
          Audiencia = tiene Segment en Resend y puede recibir newsletters. Tu plan de Resend limita
          cuántos Segments puedes tener.
        </p>
      </Section>

      <Section title="Tareas">
        {taskList.length === 0 ? (
          <Empty title={q ? 'Ningún tag coincide.' : 'Aún no hay tags de tareas.'} />
        ) : (
          <List>
            {taskList.map((t) => (
              <TaskTagRow
                key={t.tag}
                tag={t}
                onRename={(name) => void run(() => tasks.renameTag(t.tag, name).then(reloadTasks))}
                onRemove={() => void run(() => tasks.removeTag(t.tag).then(reloadTasks))}
              />
            ))}
          </List>
        )}
      </Section>
    </Page>
  )
}

function ContactTagRow({
  tag,
  onRename,
  onAudience,
  onRemove
}: {
  tag: TagSummary
  onRename: (name: string) => void
  onAudience: (on: boolean) => void
  onRemove: () => void
}): React.JSX.Element {
  return (
    <Row>
      <span className="w-48 shrink-0">
        <EditableText value={tag.name} label={`Nombre del tag ${tag.slug}`} onSave={onRename} className="text-list font-bold" />
      </span>
      <span className="min-w-0 flex-1 truncate text-caption text-milk-soft">
        {tag.contacts === 0 ? 'Sin uso' : `${tag.contacts} contactos · ${tag.subscribed} suscritos`}
        <span className="ml-2 font-mono text-micro text-milk-faint">{tag.slug}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={tag.audience}
        onClick={() => onAudience(!tag.audience)}
        title={tag.audience ? 'Quitar audiencia (borra su Segment)' : 'Marcar como audiencia (crea su Segment)'}
        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-micro font-bold transition-colors ${
          tag.audience ? 'bg-surface-raised text-milk' : 'text-milk-soft hover:bg-surface-raised hover:text-milk'
        }`}
      >
        <Radio size={14} strokeWidth={2.5} className={tag.audience ? 'text-apricot' : ''} />
        Audiencia
      </button>
      <ConfirmButton
        label={`Borrar tag ${tag.name}`}
        confirmLabel={tag.contacts ? `¿Quitar de ${tag.contacts}?` : '¿Borrar?'}
        onConfirm={onRemove}
        size="sm"
      />
    </Row>
  )
}

function TaskTagRow({
  tag,
  onRename,
  onRemove
}: {
  tag: TaskTagSummary
  onRename: (name: string) => void
  onRemove: () => void
}): React.JSX.Element {
  return (
    <Row>
      <span className="w-48 shrink-0">
        <EditableText value={tag.tag} label={`Renombrar #${tag.tag}`} onSave={onRename} className="text-list font-bold" />
      </span>
      <span className="min-w-0 flex-1 truncate text-caption text-milk-soft">
        {tag.tasks} {tag.tasks === 1 ? 'tarea' : 'tareas'}
      </span>
      <TagPill tag={{ slug: tag.tag, name: `#${tag.tag}` }} />
      <ConfirmButton
        label={`Quitar #${tag.tag} de todas las tareas`}
        confirmLabel={`¿Quitar de ${tag.tasks}?`}
        onConfirm={onRemove}
        size="sm"
      />
    </Row>
  )
}
