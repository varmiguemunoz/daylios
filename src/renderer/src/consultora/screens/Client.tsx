import { useCallback, useState } from 'react'
import { FolderOpen, Plus } from 'lucide-react'
import type { ClientInput } from '@shared/consultora'
import { api, attempt, bytes, dateTime, openPath, shortDate, useLoad, type Go } from '../lib'
import {
  Button,
  EditableText,
  Empty,
  ErrorNote,
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

/** Ficha de cliente: datos, proyectos, reuniones, action items abiertos, notas y documentos. */
export function Client({
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
  const load = useCallback(() => api.getClient(id), [id])
  const { data: c, error: loadError } = useLoad(load)
  const [error, setError] = useState<string | null>(null)
  const [newProject, setNewProject] = useState<string | null>(null)

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
      <Page back={{ label: backLabel, onClick: back }} title="…">
        <ErrorNote message={loadError} />
      </Page>
    )

  return (
    <Page
      back={{ label: backLabel, onClick: back }}
      title={
        <EditableText
          value={c.name}
          label="Nombre del cliente"
          onSave={(name) => void save({ name })}
        />
      }
      meta={
        <>
          <span className="w-56">
            <EditableText
              value={c.sector ?? ''}
              placeholder="Sector o empresa"
              label="Sector"
              className="text-caption"
              onSave={(sector) => void save({ sector })}
            />
          </span>
          <span>Firmado {shortDate(c.signedAt)}</span>
        </>
      }
      actions={
        <>
          <Select
            label="Estado"
            value={c.status}
            options={[
              { value: 'activo', label: 'Activo' },
              { value: 'historico', label: 'Histórico' }
            ]}
            onChange={(status) => void save({ status: status as ClientInput['status'] })}
          />
          <Button
            onClick={() => void openPath(c.folderPath).catch((e) => setError(String(e)))}
            title={c.folderPath}
          >
            <FolderOpen size={15} strokeWidth={2.5} />
            Carpeta
          </Button>
        </>
      }
    >
      <ErrorNote message={error ?? loadError} />

      <Section
        title="Proyectos"
        aside={
          <Button onClick={() => setNewProject('')}>
            <Plus size={15} strokeWidth={3} />
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
              className="h-12 w-full rounded-md bg-surface px-5 text-list outline-none focus:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]"
            />
          </form>
        )}
        {c.projects.length === 0 ? (
          <Empty title="Sin proyectos." hint="Crea el primero con «Nuevo»." />
        ) : (
          <List>
            {c.projects.map((p) => (
              <Row key={p.id} onClick={() => go({ name: 'project', id: p.id })}>
                <span className="min-w-0 flex-1 truncate text-list font-bold">{p.name}</span>
                {p.openDeliverables.length > 0 && (
                  <span className="text-caption text-milk-soft">
                    {p.openDeliverables.length}{' '}
                    {p.openDeliverables.length === 1
                      ? 'entregable pendiente'
                      : 'entregables pendientes'}
                  </span>
                )}
                <ProjectStatusPill status={p.status} />
              </Row>
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
                  className="size-5 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--color-milk-faint)] transition-shadow hover:shadow-[inset_0_0_0_1.5px_var(--color-apricot)]"
                />
                <span className="min-w-0 flex-1 text-list">{a.text}</span>
                <span className="shrink-0 text-caption text-milk-soft">
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
            hint="Graba una con «Grabar» arriba o créala en Reuniones."
          />
        ) : (
          <List>
            {c.meetings.slice(0, 8).map((m) => (
              <Row key={m.id} onClick={() => go({ name: 'meeting', id: m.id })}>
                <span className="min-w-0 flex-1 truncate text-list font-bold">{m.title}</span>
                <MeetingStatusPill status={m.status} />
                <span className="shrink-0 text-caption text-milk-soft">{dateTime(m.date)}</span>
              </Row>
            ))}
          </List>
        )}
      </Section>

      <ContactsSection contacts={c.contacts} client={c.id} go={go} />

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
          <MarkdownField value={c.contactsMd} placeholder="" onSave={(contactsMd) => void save({ contactsMd })} />
        </Section>
      )}

      <Section
        title="Documentos"
        aside={
          <span className="truncate text-caption text-milk-soft" title={c.folderPath}>
            {c.folderPath}
          </span>
        }
      >
        {c.documents.length === 0 ? (
          <Empty
            title="Carpeta vacía."
            hint="Sube contratos, entregables y documentación técnica a la carpeta del cliente."
          />
        ) : (
          <List>
            {c.documents.map((d) => (
              <Row
                key={d.path}
                onClick={() =>
                  void openPath(`${c.folderPath}/${d.path}`).catch((e) => setError(String(e)))
                }
              >
                <span className="min-w-0 flex-1 truncate text-list">{d.name}</span>
                <span className="shrink-0 text-caption text-milk-soft">
                  {d.folder === '.' ? '' : d.folder}
                </span>
                <span className="w-20 shrink-0 text-right text-caption text-milk-soft">
                  {bytes(d.size)}
                </span>
                <span className="w-28 shrink-0 text-right text-caption text-milk-soft">
                  {shortDate(d.modifiedAt)}
                </span>
              </Row>
            ))}
          </List>
        )}
      </Section>
    </Page>
  )
}
