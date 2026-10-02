import { useCallback, useState } from 'react'
import type { ProjectInput, ProjectStatus } from '@shared/consultora'
import { api, attempt, dateTime, useLoad, type Go } from '../lib'
import {
  EditableText,
  Empty,
  ErrorNote,
  List,
  MarkdownField,
  MeetingStatusPill,
  Page,
  Row,
  Section,
  Select
} from '../ui'

/** Proyecto: estado, objetivo, entregables (casillas marcables), notas y reuniones. */
export function Project({
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
  const load = useCallback(() => api.getProject(id), [id])
  const { data: p, error: loadError } = useLoad(load)
  const [error, setError] = useState<string | null>(null)

  const save = async (patch: ProjectInput): Promise<void> =>
    setError(await attempt(() => api.updateProject(id, patch)))

  if (!p)
    return (
      <Page back={{ label: backLabel, onClick: back }} title="…">
        <ErrorNote message={loadError} />
      </Page>
    )

  const pending = p.openDeliverables.length

  return (
    <Page
      back={{ label: backLabel, onClick: back }}
      title={
        <EditableText
          value={p.name}
          label="Nombre del proyecto"
          onSave={(name) => void save({ name })}
        />
      }
      meta={
        <>
          <button
            type="button"
            onClick={() => go({ name: 'client', id: p.client.id })}
            className="font-bold text-milk hover:text-apricot"
          >
            {p.client.name}
          </button>
          <span>·</span>
          <span>
            {pending ? `${pending} entregables pendientes` : 'Sin entregables pendientes'}
          </span>
        </>
      }
      actions={
        <Select
          label="Estado"
          value={p.status}
          options={[
            { value: 'activo', label: 'Activo' },
            { value: 'pausa', label: 'En pausa' },
            { value: 'cerrado', label: 'Cerrado' }
          ]}
          onChange={(status) => void save({ status: status as ProjectStatus })}
        />
      }
    >
      <ErrorNote message={error ?? loadError} />

      <Section title="Objetivo">
        <MarkdownField
          value={p.objectiveMd}
          placeholder="Qué se construye y para qué. Alcance, éxito, restricciones…"
          onSave={(objectiveMd) => void save({ objectiveMd })}
        />
      </Section>

      <Section title="Entregables y épicas">
        <MarkdownField
          value={p.deliverablesMd}
          placeholder={'- [ ] Primer entregable\n- [ ] Segunda épica'}
          onSave={(deliverablesMd) => void save({ deliverablesMd })}
        />
      </Section>

      <Section title="Notas de contexto">
        <MarkdownField
          value={p.notesMd}
          placeholder="Decisiones técnicas, accesos, riesgos, acuerdos…"
          onSave={(notesMd) => void save({ notesMd })}
        />
      </Section>

      <Section title="Reuniones del proyecto">
        {p.meetings.length === 0 ? (
          <Empty
            title="Sin reuniones."
            hint="Asocia una reunión a este proyecto desde su detalle."
          />
        ) : (
          <List>
            {p.meetings.map((m) => (
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
