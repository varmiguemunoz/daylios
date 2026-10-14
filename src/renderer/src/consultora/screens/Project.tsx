import { useCallback, useState } from 'react'
import { Activity, Briefcase, ListChecks } from 'lucide-react'
import type { ProjectInput, ProjectStatus } from '@shared/consultora'
import { api, attempt, dateTime, useLoad, type Go } from '../lib'
import {
  ConfirmButton,
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
import { useScreenTitle } from '../chrome'
import { Properties, PropertyRow } from '../molecules/Properties'

/** Proyecto: estado, objetivo, entregables (casillas marcables), notas y reuniones. */
export function Project({
  id,
  go,
  back
}: {
  id: string
  go: Go
  back: () => void
}): React.JSX.Element {
  const load = useCallback(() => api.getProject(id), [id])
  const { data: p, error: loadError } = useLoad(load)
  useScreenTitle(p?.name)
  const [error, setError] = useState<string | null>(null)

  const save = async (patch: ProjectInput): Promise<void> =>
    setError(await attempt(() => api.updateProject(id, patch)))

  if (!p)
    return (
      <Page variant="document" title="…">
        <ErrorNote message={loadError} />
      </Page>
    )

  const pending = p.openDeliverables.length

  return (
    <Page
      variant="document"
      title={
        <EditableText
          value={p.name}
          label="Nombre del proyecto"
          onSave={(name) => void save({ name })}
        />
      }
      actions={
        <>
          <ConfirmButton
            label="Borrar proyecto (sus reuniones se quedan en el cliente)"
            onConfirm={() =>
              void attempt(() => api.removeProject(id)).then((failed) =>
                failed ? setError(failed) : back()
              )
            }
          />
        </>
      }
    >
      <ErrorNote message={error ?? loadError} />

      <Properties id="project">
        <PropertyRow icon={Briefcase} label="Cliente">
          <button
            type="button"
            onClick={() => go({ name: 'client', id: p.client.id })}
            className="block h-[26px] max-w-full truncate rounded-[4px] px-1.5 text-left text-[14px] text-ob-link transition-colors hover:bg-ob-hover"
          >
            {p.client.name}
          </button>
        </PropertyRow>
        <PropertyRow icon={Activity} label="Estado">
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
        </PropertyRow>
        <PropertyRow icon={ListChecks} label="Entregables">
          <span className="block px-1.5 text-[14px] text-ob-text">
            {pending ? `${pending} pendientes` : 'Sin pendientes'}
          </span>
        </PropertyRow>
      </Properties>

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
                <span className="min-w-0 flex-1 truncate text-list font-medium">{m.title}</span>
                <MeetingStatusPill status={m.status} />
                <span className="shrink-0 text-caption text-ob-muted">{dateTime(m.date)}</span>
              </Row>
            ))}
          </List>
        )}
      </Section>
    </Page>
  )
}
