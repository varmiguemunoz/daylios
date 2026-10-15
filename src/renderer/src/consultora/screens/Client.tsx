import { useCallback, useState } from 'react'
import {
  Activity,
  Building2,
  CalendarCheck,
  FilePen,
  FolderOpen,
  NotebookPen,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react'
import type { ClientInput, DocFile } from '@shared/consultora'
import { api, attempt, bytes, dateTime, openPath, shortDate, useLoad, type Go } from '../lib'
import {
  ActionRow,
  Button,
  ConfirmButton,
  EditableText,
  Empty,
  ErrorNote,
  IconButton,
  List,
  MarkdownField,
  MeetingStatusPill,
  Page,
  ProjectStatusPill,
  Row,
  Section,
  Select
} from '../ui'
import { ContactsSection } from '../ContactsSection'
import { TasksSection } from '../organisms/tasks/TasksSection'
import { useGoneRedirect, useScreenTitle } from '../chrome'
import { InlineField } from '../molecules/InlineField'
import { Properties, PropertyRow } from '../molecules/Properties'
import { DeleteClientModal } from '../organisms/DeleteClientModal'
import { NotePicker } from '../../components/NotePicker'
import { notesApi } from '../../lib/api'
import { Authorship } from '../organisms/orgs/Authorship'
import { AutomationsSection } from '../organisms/automation/AutomationsSection'
import { EntityActivity } from '../organisms/activity/EntityActivity'

const EDITABLE = /\.(md|txt|csv|json)$/i

export function Client({
  id,
  go,
  back
}: {
  id: string
  go: Go
  back: () => void
}): React.JSX.Element {
  const load = useCallback(() => api.getClient(id), [id])
  const { data: c, error: loadError } = useLoad(load)
  useScreenTitle(c?.name)
  useGoneRedirect(loadError)
  const [error, setError] = useState<string | null>(null)
  const [newProject, setNewProject] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [linking, setLinking] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>): Promise<void> => setError(await attempt(fn))

  const newNote = async (): Promise<void> => {
    let noteId = ''
    const failed = await attempt(async () => {
      noteId = (await notesApi.create('', { clients: [id] })).id
    })
    setError(failed)
    if (!failed) go({ name: 'note', id: noteId })
  }

  const renameDoc = async (doc: DocFile, name: string): Promise<void> => {
    setRenaming(null)
    if (name.trim() && name.trim() !== doc.name)
      await run(() => api.renameDocument(id, doc.path, name.trim()))
  }

  const save = async (patch: ClientInput): Promise<void> =>
    setError(await attempt(() => api.updateClient(id, patch)))

  const createProject = async (): Promise<void> => {
    if (!newProject?.trim()) return setNewProject(null)
    let projectId = ''
    const failed = await attempt(async () => {
      projectId = (await api.createProject({ client: id, name: newProject })).id
    })
    setError(failed)
    if (!failed) go({ name: 'project', id: projectId })
  }

  if (!c)
    return (
      <Page variant="document" title="…">
        <ErrorNote message={loadError} />
      </Page>
    )

  return (
    <Page
      variant="document"
      title={
        <EditableText
          value={c.name}
          label="Nombre del cliente"
          onSave={(name) => void save({ name })}
        />
      }
      actions={
        <>
          <IconButton
            label="Abrir carpeta en Finder"
            onClick={() => void openPath(c.folderPath).catch((e) => setError(String(e)))}
          >
            <FolderOpen size={16} />
          </IconButton>
          <IconButton label="Borrar cliente" tone="danger" onClick={() => setDeleting(true)}>
            <Trash2 size={16} />
          </IconButton>
        </>
      }
    >
      <Properties id="client">
        <InlineField
          icon={Building2}
          label="Sector"
          value={c.sector}
          placeholder="Sector o empresa"
          onSave={(sector) => void save({ sector })}
        />
        <PropertyRow icon={Activity} label="Estado">
          <Select
            label="Estado"
            value={c.status}
            options={[
              { value: 'activo', label: 'Activo' },
              { value: 'historico', label: 'Histórico' }
            ]}
            onChange={(status) => void save({ status: status as ClientInput['status'] })}
          />
        </PropertyRow>
        <PropertyRow icon={CalendarCheck} label="Firmado">
          <span className="block px-1.5 text-[14px] text-ob-text">{shortDate(c.signedAt)}</span>
        </PropertyRow>
        <PropertyRow icon={FolderOpen} label="Carpeta">
          <button
            type="button"
            title="Abrir en Finder"
            onClick={() => void openPath(c.folderPath).catch((e) => setError(String(e)))}
            className="block h-[26px] max-w-full truncate rounded-[4px] px-1.5 text-left text-[14px] text-ob-link transition-colors hover:bg-ob-hover"
          >
            {c.folderPath}
          </button>
        </PropertyRow>
      </Properties>
      <Authorship table="clients" id={c.id} />

      <DeleteClientModal
        open={deleting}
        client={{ id: c.id, name: c.name }}
        onClose={() => setDeleting(false)}
        onDeleted={() => {
          setDeleting(false)
          back()
        }}
      />
      <ErrorNote message={error ?? loadError} />

      <Section
        title="Proyectos"
        aside={
          <Button onClick={() => setNewProject('')}>
            <Plus size={15} />
            Nuevo
          </Button>
        }
      >
        {newProject !== null && (
          <form
            className="mb-3"
            onSubmit={(e) => {
              e.preventDefault()
              void createProject()
            }}
          >
            <input
              autoFocus
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setNewProject(null)}
              placeholder="Nombre del proyecto y Enter"
              aria-label="Nombre del proyecto"
              className="h-8 w-full rounded-[4px] border border-ob-border bg-ob-bg px-2.5 text-[14px] text-ob-text outline-none placeholder:text-ob-faint focus:border-ob-accent"
            />
          </form>
        )}
        {c.projects.length === 0 ? (
          <Empty title="Sin proyectos." hint="Crea el primero con «Nuevo»." />
        ) : (
          <List>
            {c.projects.map((p) => (
              <ActionRow
                key={p.id}
                onClick={() => go({ name: 'project', id: p.id })}
                actions={
                  <ConfirmButton
                    label={`Borrar proyecto ${p.name}`}
                    onConfirm={() => void run(() => api.removeProject(p.id))}
                    size="sm"
                  />
                }
              >
                <span className="min-w-0 flex-1 truncate text-list font-medium">{p.name}</span>
                {p.openDeliverables.length > 0 && (
                  <span className="text-caption text-ob-muted">
                    {p.openDeliverables.length}{' '}
                    {p.openDeliverables.length === 1
                      ? 'entregable pendiente'
                      : 'entregables pendientes'}
                  </span>
                )}
                <ProjectStatusPill status={p.status} />
              </ActionRow>
            ))}
          </List>
        )}
      </Section>

      {c.openActionItems.length > 0 && (
        <Section title="Action items abiertos">
          <List>
            {c.openActionItems.map((a) => (
              <Row key={`${a.meetingId}-${a.index}`}>
                <button
                  type="button"
                  aria-label="Marcar hecho"
                  onClick={() =>
                    void attempt(() =>
                      api.updateActionItem(a.meetingId, a.index, { done: true })
                    ).then(setError)
                  }
                  className="size-5 shrink-0 rounded-[4px] shadow-[inset_0_0_0_1.5px_var(--color-ob-faint)] transition-shadow hover:shadow-[inset_0_0_0_1.5px_var(--color-ob-accent)]"
                />
                <span className="min-w-0 flex-1 text-list">{a.text}</span>
                <span className="shrink-0 text-caption text-ob-muted">
                  {[a.owner, a.due].filter(Boolean).join(' · ')}
                </span>
              </Row>
            ))}
          </List>
        </Section>
      )}

      <Section title="Reuniones">
        {c.meetings.length === 0 ? (
          <Empty
            title="Sin reuniones."
            hint="Graba una con «Grabar» en la franja superior o créala en Reuniones."
          />
        ) : (
          <List>
            {c.meetings.slice(0, 8).map((m) => (
              <Row key={m.id} onClick={() => go({ name: 'meeting', id: m.id })}>
                <span className="min-w-0 flex-1 truncate text-list font-medium">{m.title}</span>
                <MeetingStatusPill status={m.status} />
                <span className="shrink-0 text-caption text-ob-muted">{dateTime(m.date)}</span>
              </Row>
            ))}
          </List>
        )}
      </Section>

      <TasksSection kind="client" id={c.id} />

      <ContactsSection contacts={c.contacts} client={c.id} go={go} />

      <Section
        title="Notas"
        aside={
          <div className="flex gap-2">
            <Button onClick={() => setLinking(true)}>Relacionar nota</Button>
            <Button onClick={() => void newNote()}>
              <Plus size={15} />
              Nueva nota
            </Button>
          </div>
        }
      >
        {c.notes.length === 0 ? (
          <Empty
            title="Sin notas relacionadas."
            hint="Crea una aquí o relaciónala desde la propia nota."
          />
        ) : (
          <List>
            {c.notes.map((n) => (
              <ActionRow
                key={n.id}
                onClick={() => go({ name: 'note', id: n.id })}
                actions={
                  <IconButton
                    label={`Quitar relación con ${n.title}`}
                    size="sm"
                    tone="danger"
                    onClick={() => void run(() => notesApi.unlink(n.id, { type: 'client', id }))}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                }
              >
                <NotebookPen size={15} className="shrink-0 text-ob-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-list font-medium">{n.title}</span>
                  {n.excerpt && (
                    <span className="block truncate text-caption text-ob-muted">{n.excerpt}</span>
                  )}
                </span>
                <span className="shrink-0 text-caption text-ob-muted">
                  {shortDate(n.updatedAt)}
                </span>
              </ActionRow>
            ))}
          </List>
        )}
        <NotePicker
          open={linking}
          noteId=""
          exclude={c.notes.map((n) => n.id)}
          notesOnly
          onPick={(target) => {
            setLinking(false)
            void run(() => notesApi.link(target.id, { type: 'client', id }))
          }}
          onClose={() => setLinking(false)}
        />
      </Section>

      <Section title="Notas de contexto">
        <MarkdownField
          value={c.notesMd}
          placeholder="Cómo trabajan, qué les importa, acuerdos comerciales…"
          onSave={(notesMd) => void save({ notesMd })}
        />
      </Section>

      {/* Texto de contactos de antes de existir la base de contactos: solo si tiene algo */}
      {c.contactsMd.trim() && (
        <Section title="Notas de contactos">
          <MarkdownField
            value={c.contactsMd}
            placeholder=""
            onSave={(contactsMd) => void save({ contactsMd })}
          />
        </Section>
      )}

      <Section title="Documentos">
        {c.documents.length === 0 ? (
          <Empty
            title="Carpeta vacía."
            hint="Sube contratos, entregables y documentación técnica a la carpeta del cliente."
          />
        ) : (
          <List>
            {c.documents.map((d) =>
              renaming === d.path ? (
                <li key={d.path} className="px-3 py-2">
                  <input
                    autoFocus
                    defaultValue={d.name}
                    aria-label={`Nuevo nombre de ${d.name}`}
                    onFocus={(e) => {
                      const dot = e.currentTarget.value.lastIndexOf('.')
                      e.currentTarget.setSelectionRange(
                        0,
                        dot > 0 ? dot : e.currentTarget.value.length
                      )
                    }}
                    onBlur={(e) => void renameDoc(d, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setRenaming(null)
                      }
                    }}
                    className="h-8 w-full px-3 text-[14px] rounded-[4px] border border-ob-border bg-ob-bg text-ob-text outline-none placeholder:text-ob-faint focus:border-ob-accent"
                  />
                </li>
              ) : (
                <ActionRow
                  key={d.path}
                  onClick={() =>
                    void openPath(`${c.folderPath}/${d.path}`).catch((e) => setError(String(e)))
                  }
                  actions={
                    <>
                      {EDITABLE.test(d.name) && (
                        <IconButton
                          label={`Editar ${d.name}`}
                          size="sm"
                          onClick={() => go({ name: 'document', client: id, path: d.path })}
                        >
                          <FilePen size={15} />
                        </IconButton>
                      )}
                      <IconButton
                        label={`Renombrar ${d.name}`}
                        size="sm"
                        onClick={() => setRenaming(d.path)}
                      >
                        <Pencil size={14} />
                      </IconButton>
                      <ConfirmButton
                        label={`Mandar ${d.name} a la Papelera`}
                        confirmLabel="¿A la Papelera?"
                        onConfirm={() => void run(() => api.trashDocument(id, d.path))}
                        size="sm"
                      />
                    </>
                  }
                >
                  <span className="min-w-0 flex-1 truncate text-list">{d.name}</span>
                  <span className="shrink-0 text-caption text-ob-muted">
                    {d.folder === '.' ? '' : d.folder}
                  </span>
                  <span className="w-20 shrink-0 text-right text-caption text-ob-muted">
                    {bytes(d.size)}
                  </span>
                  <span className="w-28 shrink-0 text-right text-caption text-ob-muted">
                    {shortDate(d.modifiedAt)}
                  </span>
                </ActionRow>
              )
            )}
          </List>
        )}
      </Section>
      <AutomationsSection subject="client" subjectId={c.id} go={go} />
      <EntityActivity entity="clients" id={id} />
    </Page>
  )
}
