import { randomUUID } from 'crypto'
import type { DataSource } from 'typeorm'
import {
  DEFAULT_LAYOUT,
  MAX_WIDGETS,
  METRIC_PERIODS,
  WIDGET_KINDS,
  WIDGET_SIZES,
  type Dashboard,
  type DashboardLayout,
  type WidgetPlacement,
  type WidgetSettings
} from '@shared/metrics'
import { DashboardModel, type DashboardRow } from '../models/metrics.model'
import { AppError } from './app.error'
import { now } from './fields'
import { teamUserId } from '../scope'

const owner = (): string => teamUserId() ?? 'local'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export class DashboardService {
  constructor(private readonly db: DataSource) {}

  async get(): Promise<Dashboard> {
    const row = await this.row()
    if (!row) return toDashboard(await this.write(DEFAULT_LAYOUT))
    try {
      return toDashboard(row)
    } catch {
      // Un diseño ilegible no rompe Inicio: vuelve al inicial.
      return toDashboard(await this.write(DEFAULT_LAYOUT))
    }
  }

  async save(input: unknown): Promise<Dashboard> {
    return toDashboard(await this.write(parseLayout(input)))
  }

  async reset(): Promise<Dashboard> {
    return toDashboard(await this.write(DEFAULT_LAYOUT))
  }

  private row(): Promise<DashboardRow | null> {
    return this.db
      .getRepository(DashboardModel)
      .findOne({ where: { owner: owner() }, order: { updatedAt: 'ASC' } })
  }

  private async write(layout: DashboardLayout): Promise<DashboardRow> {
    // Id global único: con la nube, los dashboards de cada persona no chocan.
    const row: DashboardRow = {
      id: (await this.row())?.id ?? randomUUID(),
      name: 'Inicio',
      owner: owner(),
      layout: JSON.stringify(layout),
      updatedAt: now()
    }
    await this.db.getRepository(DashboardModel).save(row)
    return row
  }
}

function toDashboard(row: DashboardRow): Dashboard {
  return {
    id: row.id,
    name: row.name,
    layout: parseLayout(JSON.parse(row.layout)),
    updatedAt: row.updatedAt
  }
}

export function parseLayout(input: unknown): DashboardLayout {
  const raw = input as Partial<DashboardLayout> | null
  if (!raw || raw.version !== 1 || !Array.isArray(raw.widgets)) {
    throw new AppError('invalid', 'El diseño del dashboard no es válido.')
  }
  if (raw.widgets.length > MAX_WIDGETS) {
    throw new AppError('invalid', `Un dashboard admite hasta ${MAX_WIDGETS} componentes.`)
  }
  const ids = new Set<string>()
  const widgets = raw.widgets.map((w): WidgetPlacement => {
    const item = w as Partial<WidgetPlacement>
    if (typeof item?.id !== 'string' || !item.id || item.id.length > 64 || ids.has(item.id)) {
      throw new AppError('invalid', 'Cada componente necesita un id único.')
    }
    ids.add(item.id)
    if (!WIDGET_KINDS.includes(item.kind as never)) {
      throw new AppError('invalid', `Componente desconocido: ${String(item.kind)}.`)
    }
    return {
      id: item.id,
      kind: item.kind!,
      size: WIDGET_SIZES.includes(item.size as never) ? item.size! : 'quarter',
      rows: item.rows === 2 ? 2 : 1,
      settings: parseSettings(item.settings)
    }
  })
  return { version: 1, widgets }
}

function parseSettings(input: unknown): WidgetSettings {
  const raw = (input ?? {}) as WidgetSettings
  const out: WidgetSettings = {}
  if (METRIC_PERIODS.some((p) => p.id === raw.period)) out.period = raw.period
  if (out.period === 'range') {
    if (!DAY.test(raw.from ?? '') || !DAY.test(raw.to ?? '') || raw.from! > raw.to!) {
      throw new AppError('invalid', 'El rango de un componente necesita dos fechas en orden.')
    }
    out.from = raw.from
    out.to = raw.to
  }
  if (typeof raw.pipeline === 'string' && raw.pipeline) out.pipeline = raw.pipeline.slice(0, 64)
  return out
}
