import type { DataSource } from 'typeorm'
import { TagService } from './services/tag.service'
import { MarketingSync } from './services/marketing-sync'
import { SourceService } from './services/source.service'
import { SequenceService } from './services/sequence.service'
import { NewsletterService } from './services/newsletter.service'
import { HubSync } from './services/hub-sync'
import {
  DELIVERY_ROLES,
  DeliveryUsageError,
  type DeliveryRouter,
  type ProviderId,
  type ProviderRegistry
} from '@shared/email-delivery'
import type { EmailProviderSummary, OutreachSequence, OutreachStatus } from '@shared/marketing'
import type { RemoteSequence } from '@shared/email-delivery'
import { onRolesChanged } from './config'
import { resetAudience } from './services/audience-reset'
import { OutreachService } from './services/outreach.service'
import { OutreachSync } from './services/outreach-sync'
import type { HubProvider } from './services/hub.client'

export function createMarketing(
  db: DataSource,
  delivery: DeliveryRouter,
  hub: HubProvider,
  notify: () => void,
  registry: ProviderRegistry | null = null
): Marketing {
  const sync = new MarketingSync(db, delivery, notify)
  const hubSync = new HubSync(db, hub)
  sync.pull = async () => {
    if (await hubSync.pull()) notify()
  }
  sync.hubConfigured = () => hubSync.configured()

  const configChanged = (): void => {
    hubSync.invalidate()
    sync.kick()
  }

  onRolesChanged((previous, next) => {
    if (previous.marketing === next.marketing) return
    void resetAudience(db).then(() => sync.kick())
  })

  const tags = new TagService(db, configChanged)
  const outreach = new OutreachService(db, delivery)
  const outreachSync = new OutreachSync(db, delivery, notify)
  const outreachStatus = async (): Promise<OutreachStatus> => ({
    ...(await outreach.status()),
    lastPollAt: outreachSync.lastPollAt,
    lastError: outreachSync.lastError
  })
  return {
    tags,
    sources: new SourceService(db, configChanged),
    sequences: new SequenceService(delivery),
    newsletters: new NewsletterService(db, delivery, tags, () => sync.tick()),
    sync,
    hubSync,
    outreach,
    outreachSync,
    outreachStatus,
    listOutreachSequences: async () => (await outreach.list()).map(toOutreach),
    saveOutreachSequence: async (input) => toOutreach(await outreach.save(input)),
    setOutreachSequenceStatus: async (id, enabled, confirm) =>
      toOutreach(await outreach.setEnabled(id, enabled, confirm)),
    enrollOutreach: (input) => outreach.enroll(input),
    pollOutreach: async () => {
      await outreachSync.poll()
      return outreachStatus()
    },
    delivery,
    configChanged,
    async testResend() {
      try {
        return await probe(delivery.use('marketing'))
      } catch (e) {
        if (e instanceof DeliveryUsageError) return { ok: false, message: e.message }
        throw e
      }
    },
    async emailProviders() {
      if (!registry) return []
      return registry.list().map((info): EmailProviderSummary => ({
        id: info.id,
        label: info.label,
        configured: registry.configured(info.id),
        coldOutreach: info.policy.coldOutreach,
        sender: info.policy.sender,
        capabilities: [...info.capabilities],
        roles: DELIVERY_ROLES.filter((role) => delivery.assigned(role) === info.id)
      }))
    },
    async testProvider(id) {
      const info = registry?.info(id as ProviderId)
      if (!info) return { ok: false, message: `No existe el proveedor «${id}».` }
      const provider = registry?.get(info.id)
      if (!provider) return { ok: false, message: `Falta la API key de ${info.label}.` }
      return probe(provider)
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
  outreach: OutreachService
  outreachSync: OutreachSync
  outreachStatus(): Promise<OutreachStatus>
  listOutreachSequences(): Promise<OutreachSequence[]>
  saveOutreachSequence(input: Parameters<OutreachService['save']>[0]): Promise<OutreachSequence>
  setOutreachSequenceStatus(
    id: unknown,
    enabled: unknown,
    confirm: unknown
  ): Promise<OutreachSequence>
  enrollOutreach: OutreachService['enroll']
  pollOutreach(): Promise<OutreachStatus>
  delivery: DeliveryRouter

  configChanged: () => void
  testResend(): Promise<{ ok: boolean; message: string }>
  emailProviders(): Promise<EmailProviderSummary[]>
  testProvider(id: string): Promise<{ ok: boolean; message: string }>
}

async function probe(provider: {
  label: string
  test(): Promise<void>
}): Promise<{ ok: boolean; message: string }> {
  try {
    await provider.test()
    return { ok: true, message: `Conectado con ${provider.label}.` }
  } catch (e) {
    return {
      ok: false,
      message: `${provider.label} respondió: ${e instanceof Error ? e.message : String(e)}`
    }
  }
}

const toOutreach = (s: RemoteSequence): OutreachSequence => ({
  id: s.id,
  name: s.name,
  enabled: s.enabled,
  emails: s.emails,
  createdAt: s.createdAt,
  url: s.url
})
