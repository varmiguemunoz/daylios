import type { DataSource } from 'typeorm'
import { TagService } from './services/tag.service'
import { MarketingSync } from './services/marketing-sync'
import { SourceService } from './services/source.service'
import { SequenceService } from './services/sequence.service'
import { NewsletterService } from './services/newsletter.service'
import { HubSync } from './services/hub-sync'
import type { GatewayProvider } from './services/resend.provider'
import type { HubProvider } from './services/hub.client'

export function createMarketing(
  db: DataSource,
  gateway: GatewayProvider,
  hub: HubProvider,
  notify: () => void
): Marketing {
  const sync = new MarketingSync(db, gateway, notify)
  const hubSync = new HubSync(db, hub)
  sync.pull = async () => {
    if (await hubSync.pull()) notify()
  }
  sync.hubConfigured = () => hubSync.configured()

  const configChanged = (): void => {
    hubSync.invalidate()
    sync.kick()
  }

  const tags = new TagService(db, configChanged)
  return {
    tags,
    sources: new SourceService(db, configChanged),
    sequences: new SequenceService(gateway),
    newsletters: new NewsletterService(db, gateway, tags, () => sync.tick()),
    sync,
    hubSync,
    gateway,
    configChanged,
    async testResend() {
      const g = gateway()
      if (!g) return { ok: false, message: 'Falta la API key de Resend.' }
      try {
        await g.test()
        return { ok: true, message: 'Conectado con Resend.' }
      } catch (e) {
        return {
          ok: false,
          message: `Resend respondió: ${e instanceof Error ? e.message : String(e)}`
        }
      }
    }
  }
}

export interface Marketing {
  tags: TagService
  sources: SourceService
  sequences: SequenceService
  newsletters: NewsletterService
  sync: MarketingSync
  hubSync: HubSync
  gateway: GatewayProvider

  configChanged: () => void
  testResend(): Promise<{ ok: boolean; message: string }>
}
