import type { ReactNode } from 'react'
import { TASK_STATUSES, TASK_STATUS_LABEL } from '@shared/tasks'
import type { DealsMetric, MetricsResult } from '@shared/metrics'
import { shortDate, type Go } from '../../lib'
import { StatValue } from '../../atoms/StatValue'
import { Delta } from '../../atoms/Delta'
import { BarList } from '../../molecules/BarList'
import { Sparkline } from '../../molecules/Sparkline'
import { WidgetFrame, type WidgetState } from './WidgetFrame'
import { openPipeline, openTasks, percent, rangeLabel, usd } from './lib'

export interface WidgetViewProps {
  result: MetricsResult | null
  error: string | null
  go: Go
  toolbar?: ReactNode
}

const stateOf = (props: WidgetViewProps, ready: boolean, empty = false): WidgetState =>
  props.error ? 'error' : !props.result || !ready ? 'loading' : empty ? 'empty' : 'ready'

const pipelineId = (r: MetricsResult | null): string | null => r?.pipeline?.id ?? null
const scopeName = (r: MetricsResult | null): string => (r?.pipeline ? ` · ${r.pipeline.name}` : '')

function LinkRow({
  title,
  meta,
  onClick,
  late
}: {
  title: string
  meta: string
  onClick: () => void
  late?: boolean
}): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-baseline justify-between gap-3 rounded-[4px] px-1 py-1 text-left transition-colors hover:bg-ob-hover"
      >
        <span className="min-w-0 truncate text-[13px] text-ob-text">{title}</span>
        <span className={`shrink-0 text-[12px] ${late ? 'text-ob-yellow' : 'text-ob-muted'}`}>
          {meta}
        </span>
      </button>
    </li>
  )
}

export function TasksOpenClosed(props: WidgetViewProps): React.JSX.Element {
  const m = props.result?.tasks
  return (
    <WidgetFrame
      title="Tareas abiertas y cerradas"
      state={stateOf(props, !!m)}
      error={props.error}
      toolbar={props.toolbar}
      onOpen={() => openTasks(props.go, 'open')}
      summary={
        m &&
        `${m.open} tareas abiertas ahora y ${m.closed} cerradas en el periodo, frente a ${m.closedPrevious} en el anterior.`
      }
      table={
        m && {
          columns: ['Desde', 'Cerradas'],
          rows: m.trend.map((p) => [shortDate(p.from), String(p.value)])
        }
      }
    >
      {m && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatValue value={String(m.open)} caption="Abiertas ahora" />
            <StatValue
              value={String(m.closed)}
              caption={<Delta current={m.closed} previous={m.closedPrevious} />}
            />
          </div>
          <div className="mt-3">
            <Sparkline values={m.trend.map((p) => p.value)} />
          </div>
        </>
      )}
    </WidgetFrame>
  )
}

export function TasksByStatus(props: WidgetViewProps): React.JSX.Element {
  const m = props.result?.tasksByStatus
  const total = m ? m.todo + m.doing + m.done : 0
  return (
    <WidgetFrame
      title="Tareas por estado"
      state={stateOf(props, !!m, total === 0)}
      error={props.error}
      toolbar={props.toolbar}
      emptyText="Sin tareas en este periodo."
      onOpen={() => openTasks(props.go, 'week')}
      summary={m && TASK_STATUSES.map((s) => `${TASK_STATUS_LABEL[s]} ${m[s]}`).join(', ')}
      table={
        m && {
          columns: ['Estado', 'Tareas'],
          rows: TASK_STATUSES.map((s) => [TASK_STATUS_LABEL[s], String(m[s])])
        }
      }
    >
      {m && (
        <BarList
          items={TASK_STATUSES.map((s) => ({
            id: s,
            label: TASK_STATUS_LABEL[s],
            value: m[s],
            display: String(m[s])
          }))}
        />
      )}
    </WidgetFrame>
  )
}

export function PipelineOpen(props: WidgetViewProps): React.JSX.Element {
  const m = props.result?.openPipeline
  return (
    <WidgetFrame
      title={`Pipeline abierto${scopeName(props.result)}`}
      state={stateOf(props, !!m)}
      error={props.error}
      toolbar={props.toolbar}
      onOpen={() => openPipeline(props.go, pipelineId(props.result), { kinds: ['open'] })}
      summary={m && `${usd(m.valueUsd, false)} en ${m.count} prospectos abiertos.`}
    >
      {m && (
        <StatValue
          value={usd(m.valueUsd)}
          caption={`${m.count} ${m.count === 1 ? 'prospecto abierto' : 'prospectos abiertos'}`}
        />
      )}
    </WidgetFrame>
  )
}

function Deals({
  props,
  kind,
  m
}: {
  props: WidgetViewProps
  kind: 'won' | 'lost'
  m: DealsMetric | undefined
}): React.JSX.Element {
  const won = kind === 'won'
  const noun = (n: number): string => `${n} ${n === 1 ? 'negocio' : 'negocios'}`
  return (
    <WidgetFrame
      title={`${won ? 'Negocios ganados' : 'Negocios perdidos'}${scopeName(props.result)}`}
      state={stateOf(props, !!m)}
      error={props.error}
      toolbar={props.toolbar}
      onOpen={() => openPipeline(props.go, pipelineId(props.result), { kinds: [kind] })}
      footnote={
        m?.estimated
          ? 'Algunas fechas son aproximadas: se cerraron antes del registro de etapas.'
          : undefined
      }
      summary={
        m &&
        `${noun(m.count)} por ${usd(m.valueUsd, false)}. En el periodo anterior, ${noun(m.countPrevious)} por ${usd(m.valueUsdPrevious, false)}.`
      }
      table={
        m && {
          columns: ['Empresa', 'Valor', 'Fecha'],
          rows: m.rows.map((r) => [r.company, usd(r.valueUsd, false), shortDate(r.at)])
        }
      }
    >
      {m && (
        <>
          <StatValue
            value={usd(m.valueUsd)}
            caption={
              <span className="flex flex-wrap items-center gap-x-2">
                {noun(m.count)}
                <Delta current={m.count} previous={m.countPrevious} inverse={!won} />
              </span>
            }
          />
          {m.rows.length > 0 && (
            <ul className="mt-2">
              {m.rows.slice(0, 3).map((r) => (
                <LinkRow
                  key={r.prospectId}
                  title={r.company}
                  meta={usd(r.valueUsd)}
                  onClick={() => props.go({ name: 'prospect', id: r.prospectId })}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </WidgetFrame>
  )
}

export const DealsWon = (props: WidgetViewProps): React.JSX.Element => (
  <Deals props={props} kind="won" m={props.result?.won} />
)
export const DealsLost = (props: WidgetViewProps): React.JSX.Element => (
  <Deals props={props} kind="lost" m={props.result?.lost} />
)

export function ValueByStage(props: WidgetViewProps): React.JSX.Element {
  const m = props.result?.valueByStage
  const open = (): void => openPipeline(props.go, pipelineId(props.result), { kinds: ['open'] })
  return (
    <WidgetFrame
      title={`Valor por etapa${m?.pipeline ? ` · ${m.pipeline.name}` : ' · todos'}`}
      state={stateOf(props, !!m, !m?.stages.some((s) => s.count))}
      error={props.error}
      toolbar={props.toolbar}
      emptyText="Sin prospectos en etapas abiertas."
      onOpen={open}
      summary={m?.stages.map((s) => `${s.name} ${usd(s.valueUsd, false)}`).join(', ')}
      table={
        m && {
          columns: ['Etapa', 'Prospectos', 'Valor'],
          rows: m.stages.map((s) => [s.name, String(s.count), usd(s.valueUsd, false)])
        }
      }
    >
      {m && (
        <BarList
          onSelect={open}
          items={m.stages.map((s) => ({
            id: s.id,
            label: s.name,
            value: s.valueUsd,
            display: usd(s.valueUsd)
          }))}
        />
      )}
    </WidgetFrame>
  )
}

export function WinRate(props: WidgetViewProps): React.JSX.Element {
  const m = props.result?.winRate
  return (
    <WidgetFrame
      title={`Tasa de cierre${scopeName(props.result)}`}
      state={stateOf(props, !!m)}
      error={props.error}
      toolbar={props.toolbar}
      onOpen={() => openPipeline(props.go, pipelineId(props.result), { kinds: ['won', 'lost'] })}
      summary={m && `${percent(m.rate)} con ${m.won} ganados y ${m.lost} perdidos.`}
    >
      {m && (
        <StatValue
          value={percent(m.rate)}
          caption={
            <span className="flex flex-wrap items-center gap-x-2">
              {m.won} ganados, {m.lost} perdidos
              {m.rate !== null && m.ratePrevious !== null && (
                <Delta
                  current={Math.round(m.rate * 100)}
                  previous={Math.round(m.ratePrevious * 100)}
                  format={(n) => `${n} pts`}
                />
              )}
            </span>
          }
        />
      )}
    </WidgetFrame>
  )
}

export function Overdue(props: WidgetViewProps): React.JSX.Element {
  const m = props.result?.overdue
  const today = props.result?.today
  const ago = (day: string): string => {
    if (!today) return shortDate(day)
    const days = Math.round(
      (new Date(`${today}T12:00:00`).getTime() - new Date(`${day}T12:00:00`).getTime()) / 86_400_000
    )
    return days === 1 ? 'ayer' : `hace ${days} días`
  }
  return (
    <WidgetFrame
      title="Atrasadas"
      state={stateOf(props, !!m, !m?.tasks.length && !m?.steps.length)}
      error={props.error}
      toolbar={props.toolbar}
      emptyText="Nada atrasado."
      onOpen={() => openTasks(props.go, 'overdue')}
      summary={
        m && `${m.tasks.length} tareas atrasadas y ${m.steps.length} próximos pasos vencidos.`
      }
    >
      {m && (
        <div className="flex flex-col gap-3">
          {m.tasks.length > 0 && (
            <ul>
              {m.tasks.map((t) => (
                <LinkRow
                  key={t.id}
                  title={t.title}
                  meta={ago(t.date)}
                  late
                  onClick={() => openTasks(props.go, 'overdue')}
                />
              ))}
            </ul>
          )}
          {m.steps.length > 0 && (
            <div>
              <p className="mb-1 px-1 text-[11px] font-medium text-ob-faint">Próximos pasos</p>
              <ul>
                {m.steps.map((s) => (
                  <LinkRow
                    key={s.prospectId}
                    title={s.nextStep ? `${s.company}, ${s.nextStep}` : s.company}
                    meta={ago(s.date)}
                    late
                    onClick={() => props.go({ name: 'prospect', id: s.prospectId })}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </WidgetFrame>
  )
}

export function Meetings(props: WidgetViewProps): React.JSX.Element {
  const m = props.result?.meetings
  return (
    <WidgetFrame
      title="Reuniones"
      state={stateOf(props, !!m, m?.count === 0)}
      error={props.error}
      toolbar={props.toolbar}
      emptyText="Sin reuniones en este periodo."
      onOpen={() => props.go({ name: 'meetings' })}
      summary={
        m && props.result
          ? `${m.count} reuniones entre ${rangeLabel(props.result.range)}.`
          : undefined
      }
    >
      {m && (
        <>
          <StatValue
            value={String(m.count)}
            caption={props.result && rangeLabel(props.result.range)}
          />
          <ul className="mt-2">
            {m.rows.map((r) => (
              <LinkRow
                key={r.id}
                title={r.title}
                meta={shortDate(r.date)}
                onClick={() => props.go({ name: 'meeting', id: r.id })}
              />
            ))}
          </ul>
        </>
      )}
    </WidgetFrame>
  )
}

export function ActionItems(props: WidgetViewProps): React.JSX.Element {
  const m = props.result?.actionItems
  return (
    <WidgetFrame
      title="Action items abiertos"
      state={stateOf(props, !!m, m?.count === 0)}
      error={props.error}
      toolbar={props.toolbar}
      emptyText="Todo al día."
      summary={m && `${m.count} action items sin hacer.`}
    >
      {m && (
        <>
          <StatValue value={String(m.count)} caption="Sin hacer, de todas las reuniones" />
          <ul className="mt-2">
            {m.rows.map((r) => (
              <LinkRow
                key={`${r.meetingId}-${r.index}`}
                title={r.text}
                meta={r.due ? shortDate(r.due) : r.meetingTitle}
                onClick={() => props.go({ name: 'meeting', id: r.meetingId })}
              />
            ))}
          </ul>
        </>
      )}
    </WidgetFrame>
  )
}

export function Contacts(props: WidgetViewProps): React.JSX.Element {
  const m = props.result?.contacts
  return (
    <WidgetFrame
      title="Contactos nuevos"
      state={stateOf(props, !!m)}
      error={props.error}
      toolbar={props.toolbar}
      onOpen={() => props.go({ name: 'contacts' })}
      summary={
        m &&
        `${m.created} contactos nuevos, ${m.createdPrevious} en el periodo anterior. ${m.subscribed} suscritos.`
      }
      table={
        m && {
          columns: ['Desde', 'Nuevos'],
          rows: m.trend.map((p) => [shortDate(p.from), String(p.value)])
        }
      }
    >
      {m && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatValue
              value={String(m.created)}
              caption={<Delta current={m.created} previous={m.createdPrevious} />}
            />
            <StatValue value={String(m.subscribed)} caption="Suscritos ahora" />
          </div>
          <div className="mt-3">
            <Sparkline values={m.trend.map((p) => p.value)} />
          </div>
        </>
      )}
    </WidgetFrame>
  )
}
