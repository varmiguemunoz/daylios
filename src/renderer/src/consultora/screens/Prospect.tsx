import { useCallback, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { ProspectInput } from '@shared/consultora'
import { api, attempt, dateTime, useLoad, type Go } from '../lib'
import {
  ConfirmButton,
  EditableText,
  Empty,
  ErrorNote,
  Field,
  List,
  MarkdownField,
  MeetingStatusPill,
  Page,
  Row,
  Section
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
  const pipelinesLoad = useCallback(() => api.listPipelines(), [])
  const { data: pipelines } = useLoad(pipelinesLoad)
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
  const groups: { id: string; name: string }[] = pipelines ?? [{ id: p.pipeline.id, name: p.pipeline.name }]

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
        <>
          <span>{p.pipeline.name}</span>
          {p.clientId ? (
            <button
              type="button"
              onClick={() => go({ name: 'client', id: p.clientId! })}
              className="flex items-center gap-1 font-bold text-mint"
            >
              Cliente <ArrowUpRight size={14} strokeWidth={2.5} />
            </button>
          ) : (
            <span>Prospecto</span>
          )}
        </>
      }
      actions={
        <>
          {/* Etapas de todos los pipelines: elegir una de otro pipeline lo mueve allí. */}
          <select
            value={p.stageId}
            aria-label="Etapa"
            onChange={(e) => void move(e.target.value)}
            className="h-9 max-w-full cursor-pointer rounded-full bg-surface px-3.5 text-caption font-bold text-milk outline-none hover:bg-surface-raised"
          >
            {groups.map((pl) => (
              <optgroup key={pl.id} label={pl.name}>
                {(stages ?? [p.stage])
                  .filter((st) => st.pipelineId === pl.id)
                  .map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <ConfirmButton
            label="Borrar prospecto (sus contactos y reuniones se quedan)"
            onConfirm={() =>
              void attempt(() => api.removeProspect(id)).then((failed) => (failed ? setError(failed) : back()))
            }
          />
        </>
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
