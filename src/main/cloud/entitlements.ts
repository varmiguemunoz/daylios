import { CAPABILITIES, type Capability } from '@shared/edition'
import type { EntitlementsPort } from '../ports'

const TTL_MS = 15 * 60_000

export class ServerEntitlements implements EntitlementsPort {
  private granted = new Set<Capability>()
  private fetchedAt = 0

  constructor(
    private readonly fetch: () => Promise<Capability[]>,
    private readonly now: () => number = Date.now
  ) {}

  async refresh(): Promise<void> {
    if (this.now() - this.fetchedAt < TTL_MS) return
    try {
      const list = await this.fetch()
      this.granted = new Set(list.filter((c) => CAPABILITIES.includes(c)))
      this.fetchedAt = this.now()
    } catch {
      // Sin red: se queda lo último válido.
    }
  }

  can(capability: Capability): boolean {
    return this.granted.has(capability)
  }

  list(): Capability[] {
    return [...this.granted]
  }
}
