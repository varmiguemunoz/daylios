import { IsNull, MoreThanOrEqual, type DataSource } from 'typeorm'
import type { Contact, Meeting, Prospect, Stage } from '@shared/consultora'
import {
  METRIC_KINDS,
  METRIC_PERIODS,
  dayOf,
  inRange,
  periodRange,
  previousRange,
  rangeDays,
  type ActionItemsMetric,
  type ContactsMetric,
  type DayRange,
  type DealRow,
  type DealsMetric,
  type MeetingsMetric,
  type MetricKind,
  type MetricsQuery,
  type MetricsResult,
  type OpenPipelineMetric,
  type OverdueMetric,
  type TaskCountsMetric,
  type TasksByStatusMetric,
  type TrendPoint,
  type ValueByStageMetric,
  type WinRateMetric
} from '@shared/metrics'
import { addDays, fromDayKey, todayKey, toDayKey, type DayKey, type Task } from '@shared/tasks'
import { TaskModel } from '../models/task.model'
import { StageModel } from '../models/stage.model'
import { ProspectModel } from '../models/prospect.model'
import type { PipelineRow } from '../models/pipeline.model'
import { MeetingModel } from '../models/meeting.model'
import { ContactModel } from '../models/contact.model'
import { StageEventModel, type StageEventRow } from '../models/metrics.model'
import { AppError } from './app.error'
import { findPipeline } from './pipeline.helpers'

const LIST_LIMIT = 20

// ---- Funciones puras, una por indicador ----

export function buckets(r: DayRange): DayRange[] {
  const days = rangeDays(r)
  const out: DayRange[] = []
  if (days <= 120) {
    const step = days <= 31 ? 1 : 7
    for (let from = r.from; from <= r.to; from = addDays(from, step)) {
      const to = addDays(from, step - 1)
      out.push({ from, to: to > r.to ? r.to : to })
    }
    return out
  }
  const d = fromDayKey(r.from)
  d.setDate(1)
  while (toDayKey(d) <= r.to) {
    const first = toDayKey(d)
    const last = toDayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    out.push({ from: first < r.from ? r.from : first, to: last > r.to ? r.to : last })
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

const series = (r: DayRange, days: DayKey[]): TrendPoint[] =>
  buckets(r).map((b) => ({ from: b.from, value: days.filter((d) => inRange(d, b)).length }))

const closedDay = (t: Task): DayKey | null =>
  t.status === 'done' && t.completedAt ? dayOf(t.completedAt) : null

export function taskCounts(tasks: Task[], range: DayRange, previous: DayRange): TaskCountsMetric {
  const closed = tasks.map(closedDay).filter((d): d is DayKey => d !== null)
  return {
    open: tasks.filter((t) => t.status !== 'done').length,
    closed: closed.filter((d) => inRange(d, range)).length,
    closedPrevious: closed.filter((d) => inRange(d, previous)).length,
    trend: series(range, closed)
  }
}

export function tasksByStatus(tasks: Task[], range: DayRange): TasksByStatusMetric {
  const own = tasks.filter((t) => inRange(t.date, range))
  return {
    todo: own.filter((t) => t.status === 'todo').length,
    doing: own.filter((t) => t.status === 'doing').length,
    done: own.filter((t) => t.status === 'done').length
  }
}

const value = (list: { valueUsd: number | null }[]): number =>
  list.reduce((total, p) => total + (p.valueUsd ?? 0), 0)

const inPipeline = (stage: Stage | undefined, pipelineId: string | null): boolean =>
  !!stage && (!pipelineId || stage.pipelineId === pipelineId)

export function openPipeline(
  prospects: Prospect[],
  stages: Stage[],
  pipelineId: string | null
): OpenPipelineMetric {
  const byId = new Map(stages.map((s) => [s.id, s]))
  const open = prospects.filter((p) => {
    const stage = byId.get(p.stageId)
    return stage?.kind === 'open' && inPipeline(stage, pipelineId)
  })
  return { count: open.length, valueUsd: value(open) }
}

function closings(
  events: StageEventRow[],
  kind: 'won' | 'lost',
  r: DayRange,
  pipelineId: string | null
): StageEventRow[] {
  const last = new Map<string, StageEventRow>()
  for (const e of events) {
    if (!inRange(dayOf(e.at), r)) continue
    const seen = last.get(e.prospectId)
    if (!seen || e.at >= seen.at) last.set(e.prospectId, e)
  }
  return [...last.values()].filter(
    (e) => e.toKind === kind && (!pipelineId || e.pipelineId === pipelineId)
  )
}

export function deals(
  events: StageEventRow[],
  prospects: Prospect[],
  kind: 'won' | 'lost',
  range: DayRange,
  previous: DayRange,
  pipelineId: string | null
): DealsMetric {
  const names = new Map(prospects.map((p) => [p.id, p.company]))
  const now = closings(events, kind, range, pipelineId)
  const before = closings(events, kind, previous, pipelineId)
  const rows: DealRow[] = now
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((e) => ({
      prospectId: e.prospectId,
      company: names.get(e.prospectId) ?? 'Sin nombre',
      valueUsd: e.valueUsd ?? 0,
      at: e.at,
      pipelineId: e.pipelineId
    }))
  return {
    count: now.length,
    valueUsd: value(now),
    countPrevious: before.length,
    valueUsdPrevious: value(before),
    rows,
    estimated: now.some((e) => e.source === 'backfill')
  }
}

export function winRate(
  events: StageEventRow[],
  range: DayRange,
  previous: DayRange,
  pipelineId: string | null
): WinRateMetric {
  const rate = (r: DayRange): { won: number; lost: number; rate: number | null } => {
    const won = closings(events, 'won', r, pipelineId).length
    const lost = closings(events, 'lost', r, pipelineId).length
    return { won, lost, rate: won + lost ? won / (won + lost) : null }
  }
  const now = rate(range)
  return { rate: now.rate, ratePrevious: rate(previous).rate, won: now.won, lost: now.lost }
}

export function valueByStage(
  prospects: Prospect[],
  stages: Stage[],
  pipeline: PipelineRow | null
): ValueByStageMetric {
  const open = stages
    .filter((s) => s.kind === 'open' && inPipeline(s, pipeline?.id ?? null))
    .sort((a, b) => a.position - b.position)
  const groups = new Map<string, { id: string; name: string; ids: Set<string> }>()
  for (const s of open) {
    const k = pipeline ? s.id : s.name.trim().toLowerCase()
    const group = groups.get(k) ?? { id: s.id, name: s.name, ids: new Set<string>() }
    group.ids.add(s.id)
    groups.set(k, group)
  }
  return {
    pipeline: pipeline ? { id: pipeline.id, name: pipeline.name } : null,
    stages: [...groups.values()].map((g) => {
      const own = prospects.filter((p) => g.ids.has(p.stageId))
      return { id: g.id, name: g.name, count: own.length, valueUsd: value(own) }
    })
  }
}

export function overdue(
  tasks: Task[],
  prospects: Prospect[],
  stages: Stage[],
  today: DayKey,
  pipelineId: string | null
): OverdueMetric {
  const byId = new Map(stages.map((s) => [s.id, s]))
  return {
    tasks: tasks
      .filter((t) => t.status !== 'done' && t.date < today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position)
      .slice(0, LIST_LIMIT)
      .map((t) => ({ id: t.id, title: t.title, date: t.date })),
    steps: prospects
      .filter((p) => {
        const stage = byId.get(p.stageId)
        return (
          !!p.nextStepDate &&
          p.nextStepDate < today &&
          stage?.kind === 'open' &&
          inPipeline(stage, pipelineId)
        )
      })
      .sort((a, b) => (a.nextStepDate ?? '').localeCompare(b.nextStepDate ?? ''))
      .slice(0, LIST_LIMIT)
      .map((p) => ({
        prospectId: p.id,
        company: p.company,
        nextStep: p.nextStep,
        date: p.nextStepDate as DayKey
      }))
  }
}

type MeetingBrief = Pick<Meeting, 'id' | 'title' | 'date' | 'actionItems'>

export function meetingsIn(meetings: MeetingBrief[], range: DayRange): MeetingsMetric {
  const own = meetings
    .filter((m) => inRange(dayOf(m.date), range))
    .sort((a, b) => a.date.localeCompare(b.date))
  return {
    count: own.length,
    rows: own.slice(0, LIST_LIMIT).map((m) => ({ id: m.id, title: m.title, date: dayOf(m.date) }))
  }
}

export function openActionItems(meetings: MeetingBrief[]): ActionItemsMetric {
  const rows = meetings.flatMap((m) =>
    (m.actionItems ?? []).flatMap((item, index) =>
      item.done
        ? []
        : [{ meetingId: m.id, meetingTitle: m.title, index, text: item.text, due: item.due }]
    )
  )
  rows.sort((a, b) => (a.due ?? '￿').localeCompare(b.due ?? '￿'))
  return { count: rows.length, rows: rows.slice(0, LIST_LIMIT) }
}

type ContactBrief = Pick<Contact, 'createdAt' | 'status'>

export function contactGrowth(
  contacts: ContactBrief[],
  range: DayRange,
  previous: DayRange
): ContactsMetric {
  const days = contacts.map((c) => dayOf(c.createdAt))
  return {
    created: days.filter((d) => inRange(d, range)).length,
    createdPrevious: days.filter((d) => inRange(d, previous)).length,
    subscribed: contacts.filter((c) => c.status === 'subscribed').length,
    trend: series(range, days)
  }
}

// ---- Servicio ----

const NEEDS = {
  tasks: ['tasks', 'tasksByStatus', 'overdue'],
  prospects: ['openPipeline', 'won', 'lost', 'valueByStage', 'overdue'],
  events: ['won', 'lost', 'winRate'],
  meetings: ['meetings', 'actionItems'],
  contacts: ['contacts']
} satisfies Record<string, MetricKind[]>

export class MetricsService {
  constructor(private readonly db: DataSource) {}

  async query(input: MetricsQuery, today: DayKey = todayKey()): Promise<MetricsResult> {
    const period = METRIC_PERIODS.some((p) => p.id === input?.period) ? input.period : 'week'
    if (period === 'range' && (!input.from || !input.to || input.from > input.to)) {
      throw new AppError('invalid', 'El rango necesita from y to, con from antes que to.')
    }
    const range = periodRange(period, today, { from: input.from ?? today, to: input.to ?? today })
    const previous = previousRange(range)
    const kinds = new Set(
      input?.kinds?.length ? input.kinds.filter((k) => METRIC_KINDS.includes(k)) : METRIC_KINDS
    )
    const needs = (list: MetricKind[]): boolean => list.some((k) => kinds.has(k))

    const manager = this.db.manager
    const pipeline = input?.pipeline ? await findPipeline(manager, input.pipeline) : null
    const pipelineId = pipeline?.id ?? null

    const tasks = needs(NEEDS.tasks)
      ? await manager.getRepository(TaskModel).find({
          where: { parentId: IsNull(), ...(input?.assignee ? { assigneeId: input.assignee } : {}) }
        })
      : []
    const prospects =
      needs(NEEDS.prospects) || needs(NEEDS.events)
        ? await manager.getRepository(ProspectModel).find()
        : []
    const stages = needs(NEEDS.prospects) ? await manager.getRepository(StageModel).find() : []
    // Un día de margen por la diferencia entre UTC y la hora local.
    const since = fromDayKey(addDays(previous.from, -1)).toISOString()
    const events = needs(NEEDS.events)
      ? await manager.getRepository(StageEventModel).find({ where: { at: MoreThanOrEqual(since) } })
      : []
    const meetings: MeetingBrief[] = needs(NEEDS.meetings)
      ? await manager
          .getRepository(MeetingModel)
          .find({ select: { id: true, title: true, date: true, actionItems: true } })
      : []
    const contacts: ContactBrief[] = needs(NEEDS.contacts)
      ? await manager
          .getRepository(ContactModel)
          .find({ select: { createdAt: true, status: true } })
      : []

    const result: MetricsResult = {
      today,
      range,
      previous,
      pipeline: pipeline ? { id: pipeline.id, name: pipeline.name } : null
    }
    if (kinds.has('tasks')) result.tasks = taskCounts(tasks, range, previous)
    if (kinds.has('tasksByStatus')) result.tasksByStatus = tasksByStatus(tasks, range)
    if (kinds.has('openPipeline')) result.openPipeline = openPipeline(prospects, stages, pipelineId)
    if (kinds.has('won')) result.won = deals(events, prospects, 'won', range, previous, pipelineId)
    if (kinds.has('lost'))
      result.lost = deals(events, prospects, 'lost', range, previous, pipelineId)
    if (kinds.has('valueByStage')) result.valueByStage = valueByStage(prospects, stages, pipeline)
    if (kinds.has('winRate')) result.winRate = winRate(events, range, previous, pipelineId)
    if (kinds.has('overdue')) result.overdue = overdue(tasks, prospects, stages, today, pipelineId)
    if (kinds.has('meetings')) result.meetings = meetingsIn(meetings, range)
    if (kinds.has('actionItems')) result.actionItems = openActionItems(meetings)
    if (kinds.has('contacts')) result.contacts = contactGrowth(contacts, range, previous)
    return result
  }
}
