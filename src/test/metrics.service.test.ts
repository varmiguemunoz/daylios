import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import type { Prospect, Stage } from '@shared/consultora'
import { DEFAULT_LAYOUT, periodRange, previousRange } from '@shared/metrics'
import type { Task } from '@shared/tasks'
import type { StageEventRow } from '../main/models/metrics.model'
import { isolatedConfig, memoryDb } from '../main/test/helpers'
import { ProspectService } from '../main/services/prospect.service'
import { DashboardService } from '../main/services/dashboard.service'
import {
  MetricsService,
  buckets,
  deals,
  openPipeline,
  overdue,
  taskCounts,
  valueByStage,
  winRate
} from '../main/services/metrics.service'

const task = (patch: Partial<Task>): Task => ({
  id: Math.random().toString(36).slice(2),
  title: 'T',
  date: '2026-10-12',
  done: false,
  position: 0,
  createdAt: '2026-10-01T10:00:00.000Z',
  completedAt: null,
  carriedFrom: null,
  description: null,
  tags: [],
  effort: null,
  parentId: null,
  status: 'todo',
  clientId: null,
  projectId: null,
  prospectId: null,
  assigneeId: null,
  ...patch
})

const stage = (id: string, kind: Stage['kind'], pipelineId = 'p1', position = 0): Stage => ({
  id,
  name: id,
  kind,
  pipelineId,
  position
})

const prospect = (id: string, stageId: string, valueUsd: number | null): Prospect => ({
  id,
  company: id,
  contactMd: '',
  valueUsd,
  source: null,
  stageId,
  position: 0,
  notesMd: '',
  nextStep: null,
  nextStepDate: null,
  clientId: null,
  closedAt: null,
  assigneeId: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z'
})

const event = (prospectId: string, toKind: StageEventRow['toKind'], at: string): StageEventRow => ({
  id: `${prospectId}-${at}`,
  prospectId,
  pipelineId: 'p1',
  fromStageId: null,
  toStageId: toKind,
  toKind,
  valueUsd: 1000,
  source: 'app',
  at
})

// Martes 13 de octubre de 2026
const TODAY = '2026-10-13'
const week = periodRange('week', TODAY)
const before = previousRange(week)

describe('periodos', () => {
  it('la semana va de lunes a domingo y la anterior es justo antes', () => {
    expect(week).toEqual({ from: '2026-10-12', to: '2026-10-18' })
    expect(before).toEqual({ from: '2026-10-05', to: '2026-10-11' })
  })

  it('mes, trimestre y año', () => {
    expect(periodRange('month', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(periodRange('quarter', TODAY)).toEqual({ from: '2026-10-01', to: '2026-12-31' })
    expect(periodRange('year', TODAY)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })

  it('tramos: días, semanas o meses según el largo', () => {
    expect(buckets(week)).toHaveLength(7)
    expect(buckets(periodRange('quarter', TODAY))).toHaveLength(14)
    expect(buckets(periodRange('year', TODAY))).toHaveLength(12)
  })
})

describe('indicadores', () => {
  it('tareas abiertas ahora y cerradas por periodo', () => {
    const list = [
      task({ status: 'todo' }),
      task({ status: 'doing' }),
      task({ status: 'done', done: true, completedAt: '2026-10-12T15:00:00' }),
      task({ status: 'done', done: true, completedAt: '2026-10-06T15:00:00' })
    ]
    const m = taskCounts(list, week, before)
    expect(m.open).toBe(2)
    expect(m.closed).toBe(1)
    expect(m.closedPrevious).toBe(1)
    expect(m.trend[0].value).toBe(1)
  })

  it('pipeline abierto suma solo etapas abiertas del pipeline elegido', () => {
    const stages = [stage('a', 'open'), stage('w', 'won'), stage('b', 'open', 'p2')]
    const list = [prospect('x', 'a', 100), prospect('y', 'w', 500), prospect('z', 'b', 50)]
    expect(openPipeline(list, stages, null)).toEqual({ count: 2, valueUsd: 150 })
    expect(openPipeline(list, stages, 'p1')).toEqual({ count: 1, valueUsd: 100 })
  })

  it('ganar y reabrir en el mismo periodo no cuenta', () => {
    const events = [
      event('x', 'won', '2026-10-12T10:00:00'),
      event('x', 'open', '2026-10-13T10:00:00'),
      event('y', 'won', '2026-10-12T11:00:00'),
      event('z', 'lost', '2026-10-07T11:00:00')
    ]
    const won = deals(events, [], 'won', week, before, null)
    expect(won.count).toBe(1)
    expect(won.valueUsd).toBe(1000)
    expect(won.rows[0].prospectId).toBe('y')
    const lost = deals(events, [], 'lost', week, before, null)
    expect(lost.count).toBe(0)
    expect(lost.countPrevious).toBe(1)
  })

  it('tasa de cierre: ganados sobre ganados más perdidos', () => {
    const events = [
      event('a', 'won', '2026-10-12T10:00:00'),
      event('b', 'won', '2026-10-12T10:00:00'),
      event('c', 'lost', '2026-10-12T10:00:00')
    ]
    const m = winRate(events, week, before, null)
    expect(m.rate).toBeCloseTo(2 / 3)
    expect(m.ratePrevious).toBeNull()
  })

  it('valor por etapa sin pipeline junta las etapas con el mismo nombre', () => {
    const stages = [stage('Lead', 'open'), { ...stage('Lead', 'open', 'p2'), id: 'lead2' }]
    const list = [prospect('x', 'Lead', 100), prospect('y', 'lead2', 50)]
    const m = valueByStage(list, stages, null)
    expect(m.stages).toEqual([{ id: 'Lead', name: 'Lead', count: 2, valueUsd: 150 }])
  })

  it('atrasadas: tareas abiertas de días pasados y próximos pasos vencidos', () => {
    const stages = [stage('a', 'open')]
    const late = { ...prospect('x', 'a', 0), nextStepDate: '2026-10-10', nextStep: 'Llamar' }
    const m = overdue(
      [
        task({ date: '2026-10-10' }),
        task({ date: TODAY }),
        task({ date: '2026-10-09', status: 'done' })
      ],
      [late],
      stages,
      TODAY,
      null
    )
    expect(m.tasks).toHaveLength(1)
    expect(m.steps[0].nextStep).toBe('Llamar')
  })
})

describe('MetricsService y DashboardService', () => {
  let db: DataSource

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
  })
  afterEach(() => db.destroy())

  it('un prospecto ganado hoy sube en Ganados', async () => {
    const prospects = new ProspectService(db)
    const p = await prospects.create({ company: 'Acme', valueUsd: 3000 })
    const won = (await prospects.listStages()).find((s) => s.kind === 'won')!
    await prospects.move(p.id, won.id)
    const m = await new MetricsService(db).query({ period: 'week', kinds: ['won', 'openPipeline'] })
    expect(m.won?.count).toBe(1)
    expect(m.won?.valueUsd).toBe(3000)
    expect(m.openPipeline?.count).toBe(0)
    expect(m.tasks).toBeUndefined()
  })

  it('el diseño se guarda, se valida y se restablece', async () => {
    const dashboards = new DashboardService(db)
    expect((await dashboards.get()).layout).toEqual(DEFAULT_LAYOUT)
    const layout = {
      version: 1 as const,
      widgets: [
        {
          id: 'a',
          kind: 'win-rate' as const,
          size: 'half' as const,
          rows: 1 as const,
          settings: {}
        }
      ]
    }
    expect((await dashboards.save(layout)).layout).toEqual(layout)
    await expect(
      dashboards.save({ version: 1, widgets: [{ ...layout.widgets[0], kind: 'nope' }] })
    ).rejects.toThrow(/desconocido/)
    expect((await dashboards.reset()).layout).toEqual(DEFAULT_LAYOUT)
  })
})
