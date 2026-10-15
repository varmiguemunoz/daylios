import { In, type DataSource } from 'typeorm'
import type { AutomationStatus, AutomationVersion, Definition } from '@shared/automations'
import {
  AutomationModel,
  AutomationVersionModel,
  type AutomationRow
} from '../models/automation.model'

export interface CacheEntry {
  automation: AutomationRow
  version: AutomationVersion
}

export class AutomationCache {
  private key = ''
  private entries: CacheEntry[] = []
  private statuses = new Map<string, AutomationStatus>()
  private versions = new Map<string, Definition>()

  constructor(private readonly db: DataSource) {}

  async refresh(force = false): Promise<void> {
    const [row] = (await this.db.query(
      `SELECT MAX(updated_at) AS at, COUNT(*) AS n, SUM(deleted_at IS NOT NULL) AS d FROM automations`
    )) as { at: string | null; n: number; d: number | null }[]
    const key = `${row?.at ?? ''}|${row?.n ?? 0}|${row?.d ?? 0}`
    if (!force && key === this.key) return
    this.key = key
    const all = await this.db.getRepository(AutomationModel).find()
    this.statuses = new Map(all.map((a) => [a.id, a.status]))
    const active = all.filter((a) => a.status === 'active' && a.versionId)
    const versions = active.length
      ? await this.db
          .getRepository(AutomationVersionModel)
          .findBy({ id: In(active.map((a) => a.versionId as string)) })
      : []
    for (const v of versions) this.versions.set(v.id, v.definition)
    const byId = new Map<string, AutomationVersion>(versions.map((v) => [v.id, v]))
    this.entries = active.flatMap((automation) => {
      const version = byId.get(automation.versionId as string)
      return version ? [{ automation, version }] : []
    })
  }

  invalidate(): void {
    this.key = ''
  }

  active(): CacheEntry[] {
    return this.entries
  }

  status(automationId: string): AutomationStatus | undefined {
    return this.statuses.get(automationId)
  }

  async definition(versionId: string): Promise<Definition | null> {
    const cached = this.versions.get(versionId)
    if (cached) return cached
    const version = await this.db.getRepository(AutomationVersionModel).findOneBy({ id: versionId })
    if (!version) return null
    this.versions.set(versionId, version.definition)
    return version.definition
  }
}
