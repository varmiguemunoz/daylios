import { useCallback, useState } from 'react'
import {
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  DollarSign,
  Footprints,
  SquareKanban,
  Waypoints
} from 'lucide-react'
import type { ProspectInput } from '@shared/consultora'
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
  Section
} from '../ui'
import { ContactsSection } from '../ContactsSection'
import { useScreenTitle } from '../chrome'
import { InlineField } from '../molecules/InlineField'
import { Properties, PropertyRow } from '../molecules/Properties'

/** Prospecto como una nota: propiedades de venta, contactos, notas y reuniones de venta. */
export function Prospect({
  id,
  go,
  back
}: {
  id: string
  go: Go
  back: () => void
}): React.JSX.Element {
  const load = useCallback(() => api.getProspect(id), [id])
  const { data: p, error: loadError } = useLoad(load)
  useScreenTitle(p?.company)
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
      <Page variant="document" title="…">
        <ErrorNote message={loadError} />
      </Page>
    )

  const groups: { id: string; name: string }[] = pipelines ?? [
    { id: p.pipeline.id, name: p.pipeline.name }
  ]

  return (
    <Page
      variant="document"
      title={
        <EditableText
          value={p.company}
          label="Empresa"
          onSave={(company) => void save({ company })}
        />
      }
      meta={<span>{p.pipeline.name}</span>}
      actions={
        <ConfirmButton
          label="Borrar prospecto (sus contactos y reuniones se quedan)"
          onConfirm={() =>
            void attempt(() => api.removeProspect(id)).then((failed) =>
              failed ? setError(failed) : back()
            )
          }
        />
      }
    >
      {notice && (
        <p className="mt-4 rounded-[6px] border-l-2 border-ob-green bg-ob-green/10 px-3 py-2 text-[13px] text-ob-green">
          {notice}
        </p>
      )}
      <ErrorNote message={error ?? loadError} />

      <Properties id="prospect">
        <PropertyRow icon={SquareKanban} label="Etapa">
          {/* Etapas de todos los pipelines: elegir una de otro pipeline lo mueve allí. */}
          <select
            value={p.stageId}
            aria-label="Etapa"
            onChange={(e) => void move(e.target.value)}
            className="h-[26px] max-w-full cursor-pointer rounded-[4px] bg-ob-active px-2 text-[13px] text-ob-text outline-none hover:bg-[#3f3f3f]"
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
        </PropertyRow>
        <PropertyRow icon={Briefcase} label="Cliente">
          {p.clientId ? (
            <button
              type="button"
              onClick={() => go({ name: 'client', id: p.clientId! })}
              className="flex h-[26px] items-center gap-1 rounded-[4px] px-1.5 text-[14px] text-ob-link transition-colors hover:bg-ob-hover"
            >
              Ver cliente <ArrowUpRight size={14} />
            </button>
          ) : (
            <span className="block px-1.5 text-[14px] text-ob-faint">Aún es prospecto</span>
          )}
        </PropertyRow>
        <InlineField
          icon={DollarSign}
          label="Valor (USD)"
          value={p.valueUsd === null ? null : String(p.valueUsd)}
          placeholder="Sin estimar"
          onSave={(v) => {
            const n = Number(v.replace(/[^\d.]/g, ''))
            if (v === '' || Number.isFinite(n)) void save({ valueUsd: v === '' ? null : n })
          }}
        />
        <InlineField
          icon={Waypoints}
          label="Origen"
          value={p.source}
          placeholder="Upwork, referido…"
          onSave={(source) => void save({ source })}
        />
        <InlineField
          icon={Footprints}
          label="Próximo paso"
          value={p.nextStep}
          placeholder="Enviar propuesta"
          onSave={(nextStep) => void save({ nextStep })}
        />
        <PropertyRow icon={CalendarDays} label="Fecha">
          <input
            type="date"
            value={p.nextStepDate ?? ''}
            aria-label="Fecha del próximo paso"
            onChange={(e) => void save({ nextStepDate: e.target.value || null })}
            className="h-[26px] rounded-[4px] bg-transparent px-1.5 text-[14px] text-ob-text outline-none [color-scheme:dark] hover:bg-ob-hover"
          />
        </PropertyRow>
      </Properties>

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
          <MarkdownField
            value={p.contactMd}
            placeholder=""
            onSave={(contactMd) => void save({ contactMd })}
          />
        </Section>
      )}

      <Section title="Reuniones de venta">
        {p.meetings.length === 0 ? (
          <Empty title="Sin reuniones." hint="Al grabar, asocia la reunión a este prospecto." />
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
