import { useCallback, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { ProspectInput } from '@shared/consultora'
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
import { ContactsSection } from '../ContactsSection'

/** Prospecto: etapa, valor, origen, próximo paso, contacto, notas y reuniones de venta. */
export function Prospect({
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
  const load = useCallback(() => api.getProspect(id), [id])
  const { data: p, error: loadError } = useLoad(load)
  const stagesLoad = useCallback(() => api.listStages(), [])
  const { data: stages } = useLoad(stagesLoad)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const save = async (patch: ProspectInput): Promise<void> =>
    setError(await attempt(() => api.updateProspect(id, patch)))

  const move = async (stage: string): Promise<void> => {
    let created: string | null = null
    const failed = await attempt(async () => {
      created = (await api.moveProspect(id, stage)).client?.name ?? null
    })
    setError(failed)
    setNotice(created ? `Ganado: «${created}» ya es cliente y tiene su carpeta.` : null)
  }

  if (!p)
    return (
      <Page back={{ label: backLabel, onClick: back }} title="…">
        <ErrorNote message={loadError} />
      </Page>
    )

  const input = 'bg-transparent text-caption font-semibold outline-none [color-scheme:dark]'

  return (
    <Page
      back={{ label: backLabel, onClick: back }}
      title={
        <EditableText
          value={p.company}
          label="Empresa"
          onSave={(company) => void save({ company })}
        />
      }
      meta={
        p.clientId ? (
          <button
            type="button"
            onClick={() => go({ name: 'client', id: p.clientId! })}
            className="flex items-center gap-1 font-bold text-mint"
          >
            Cliente <ArrowUpRight size={14} strokeWidth={2.5} />
          </button>
        ) : (
          <span>Prospecto</span>
        )
      }
      actions={
        <Select
          label="Etapa"
          value={p.stageId}
          options={(stages ?? [p.stage]).map((s) => ({ value: s.id, label: s.name }))}
          onChange={(stage) => void move(stage)}
        />
      }
    >
      {notice && (
        <p className="mt-4 rounded-md bg-mint/15 px-4 py-3 text-caption text-mint">{notice}</p>
      )}
      <ErrorNote message={error ?? loadError} />

      <div className="mt-6 grid grid-cols-4 gap-2">
        <Field label="Valor estimado (USD)">
          <input
            key={`v-${p.valueUsd}`}
            type="number"
            min={0}
            defaultValue={p.valueUsd ?? ''}
            onBlur={(e) =>
              e.target.value !== String(p.valueUsd ?? '') &&
              void save({ valueUsd: e.target.value === '' ? null : Number(e.target.value) })
            }
            className={input}
          />
        </Field>
        <Field label="Origen">
          <input
            key={`s-${p.source}`}
            defaultValue={p.source ?? ''}
            placeholder="Upwork, referido…"
            onBlur={(e) =>
              e.target.value !== (p.source ?? '') && void save({ source: e.target.value })
            }
            className={input}
          />
        </Field>
        <Field label="Próximo paso">
          <input
            key={`n-${p.nextStep}`}
            defaultValue={p.nextStep ?? ''}
            placeholder="Enviar propuesta"
            onBlur={(e) =>
              e.target.value !== (p.nextStep ?? '') && void save({ nextStep: e.target.value })
            }
            className={input}
          />
        </Field>
        <Field label="Fecha">
          <input
            type="date"
            value={p.nextStepDate ?? ''}
            onChange={(e) => void save({ nextStepDate: e.target.value || null })}
            className={input}
          />
        </Field>
      </div>

      <ContactsSection contacts={p.contacts} prospect={p.id} go={go} />

      <Section title="Notas de venta">
        <MarkdownField
          value={p.notesMd}
          placeholder="Necesidad, presupuesto, objeciones, competencia…"
          onSave={(notesMd) => void save({ notesMd })}
        />
      </Section>

      {p.contactMd.trim() && (
        <Section title="Notas de contacto">
          <MarkdownField value={p.contactMd} placeholder="" onSave={(contactMd) => void save({ contactMd })} />
        </Section>
      )}

      <Section title="Reuniones de venta">
        {p.meetings.length === 0 ? (
          <Empty title="Sin reuniones." hint="Al grabar, asocia la reunión a este prospecto." />
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
