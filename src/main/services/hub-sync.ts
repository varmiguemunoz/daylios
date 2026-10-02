import { createHash, randomUUID } from 'crypto'
import { IsNull, type DataSource, type EntityManager } from 'typeorm'
import type { HubConfig, HubHealth, HubItem, HubLeadItem, HubStatusItem } from '@shared/hub'
import type { Contact } from '@shared/consultora'
import { LEAD_CREATED } from '@shared/marketing'
import { ContactModel } from '../models/contact.model'
import { HubReceiptModel, LeadSourceModel, RuleModel, TagModel } from '../models/marketing.model'
import { transactionGuard } from '../guards/transaction.guard'
import { now } from './fields'
import { changeTags, logEvent, promoteContact, setStatus } from './contact.service'
import { enqueueContactSync, enqueueEvent } from './outbox'
import type { HubProvider } from './hub.client'

/**
 * Puente con el Worker `leads-hub`: empuja la config (fuentes, reglas, segments) cuando cambia
 * y descarga la cola. Cada item se aplica en su transacción y se confirma (ack) solo después.
 * Un item ya aplicado (recibo en `hub_receipts`) se confirma sin volver a aplicarse.
 */
export class HubSync {
  private pushedHash: string | null = null
  private pushedTo: unknown = null

  constructor(
    private readonly db: DataSource,
    private readonly hub: HubProvider
  ) {}

  configured(): boolean {
    return Boolean(this.hub())
  }

  /** Fuerza a empujar la config en el próximo pull (cambió una fuente o una regla). */
  invalidate(): void {
    this.pushedHash = null
  }

  async health(): Promise<{ ok: boolean; message: string; health?: HubHealth }> {
    const hub = this.hub()
    if (!hub) return { ok: false, message: 'Faltan la URL o el token del hub.' }
    try {
      const health = await hub.health()
      const missing = [
        !health.resend && 'RESEND_API_KEY',
        !health.webhooks && 'RESEND_WEBHOOK_SECRET'
      ].filter(Boolean)
      return {
        ok: true,
        health,
        message:
          `Conectado. ${health.queued} en cola, ${health.sources} fuentes.` +
          (missing.length ? ` Falta configurar en el Worker: ${missing.join(', ')}.` : '')
      }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  }

  /** Un ciclo: config (si cambió) → cola → ack. Devuelve cuántos items aplicó. */
  async pull(): Promise<number> {
    const hub = this.hub()
    if (!hub) return 0

    const hubConfig = await this.buildConfig()
    const hash = createHash('sha256').update(JSON.stringify(hubConfig)).digest('hex')
    if (hash !== this.pushedHash || hub !== this.pushedTo) {
      const saved = await hub.putConfig(hubConfig)
      await this.rememberSegments(saved.segments ?? {})
      this.pushedHash = hash
      this.pushedTo = hub
    }

    let applied = 0
    for (let round = 0; round < 10; round++) {
      const items = await hub.inbox(100)
      if (!items.length) break
      const done: string[] = []
      for (const item of items) {
        try {
          await this.apply(item)
          done.push(item.id)
          applied++
        } catch (e) {
          // Un item roto no bloquea la cola: queda sin confirmar y se reintenta en el próximo ciclo.
          console.error('[hub] no se pudo aplicar', item.id, e)
        }
      }
      if (done.length) await hub.ack(done)
      if (done.length < items.length || items.length < 100) break
    }
    return applied
  }

  /** Lo que el Worker necesita: fuentes (hash del secreto), reglas y segments conocidos. */
  async buildConfig(): Promise<HubConfig> {
    const sources = await this.db.getRepository(LeadSourceModel).find({ order: { slug: 'ASC' } })
    const rules = await this.db.getRepository(RuleModel).find({ order: { position: 'ASC' } })
    const tags = await this.db.getRepository(TagModel).find({ order: { slug: 'ASC' } })
    return {
      sources: sources.map((s) => ({
        slug: s.slug,
        name: s.name,
        secretHash: createHash('sha256').update(s.secret).digest('hex'),
        defaultTags: s.defaultTags
      })),
      rules,
      segments: Object.fromEntries(
        tags.filter((t) => t.segmentId).map((t) => [t.slug, t.segmentId!])
      )
    }
  }

  /** Aplica un item de la cola (idempotente). */
  async apply(item: HubItem): Promise<void> {
    await transactionGuard(this.db, async (manager) => {
      const receipts = manager.getRepository(HubReceiptModel)
      if (await receipts.findOneBy({ id: item.id })) return
      if (item.kind === 'lead') await applyLead(manager, item)
      else await applyStatus(manager, item)
      await receipts.insert({ id: item.id, processedAt: now() })
    })
  }

  private async rememberSegments(segments: Record<string, string>): Promise<void> {
    if (!Object.keys(segments).length) return
    await transactionGuard(this.db, (manager) => saveSegments(manager, segments))
  }
}

async function saveSegments(
  manager: EntityManager,
  segments: Record<string, string>
): Promise<void> {
  const tags = manager.getRepository(TagModel)
  for (const [slug, segmentId] of Object.entries(segments)) {
    await tags.update({ slug, segmentId: IsNull() }, { segmentId })
  }
}

/**
 * Un lead del Worker. Contacto nuevo → suscrito con su consentimiento. Existente: completa nombre
 * y campos; un contacto de trabajo (`none`) pasa a suscrito porque acaba de dejar su email;
 * una baja, rebote o queja se respeta. Si el Worker no pudo hablar con Resend, la app lo hace.
 */
async function applyLead(manager: EntityManager, item: HubLeadItem): Promise<void> {
  const repo = manager.getRepository(ContactModel)
  const { lead } = item
  let contact = await repo.findOneBy({ email: lead.email })
  const isNew = !contact
  const stamp = now()

  if (!contact) {
    contact = {
      id: randomUUID(),
      name: lead.name,
      role: null,
      email: lead.email,
      phone: typeof lead.fields.phone === 'string' ? lead.fields.phone.slice(0, 60) : null,
      linkedin: null,
      notesMd: '',
      clientId: null,
      prospectId: null,
      status: item.resend.unsubscribed ? 'unsubscribed' : 'subscribed',
      source: item.source,
      fields: lead.fields,
      consentAt: item.receivedAt,
      syncError: null,
      syncedAt: item.resend.ok ? stamp : null,
      createdAt: stamp,
      updatedAt: stamp
    } satisfies Contact
    await repo.save(contact)
  } else {
    contact.name ??= lead.name
    contact.fields = { ...contact.fields, ...lead.fields }
    if (contact.status === 'none') {
      contact.status = 'subscribed'
      contact.consentAt ??= item.receivedAt
      contact.source ??= item.source
    }
    if (item.resend.unsubscribed && contact.status === 'subscribed') contact.status = 'unsubscribed'
    contact.updatedAt = stamp
    await repo.save(contact)
  }
  await logEvent(manager, contact.id, 'lead', { source: item.source })

  await changeTags(manager, contact, {
    add: item.added,
    remove: item.removed,
    rules: false, // ya las evaluó el Worker
    remoteDone: item.resend.ok,
    extraEvents: item.resend.ok ? [] : item.events
  })
  await saveSegments(manager, item.resend.segments) // los tags ya existen
  // Siempre reconciliar: el contacto local puede tener tags o datos que Resend aún no conoce.
  await enqueueContactSync(manager, contact.id)
  if (isNew && !item.resend.ok && contact.status === 'subscribed') {
    await enqueueEvent(manager, contact.id, LEAD_CREATED, { source: item.source })
  }

  if (item.promote !== null && !contact.prospectId) {
    try {
      await promoteContact(manager, contact, item.promote)
    } catch {
      // La etapa de la regla ya no existe: a la primera etapa abierta.
      await promoteContact(manager, contact, '')
    }
  }

  const sources = manager.getRepository(LeadSourceModel)
  const source = await sources.findOneBy({ slug: item.source })
  if (source) {
    source.receivedCount += 1
    if (!source.lastReceivedAt || source.lastReceivedAt < item.receivedAt)
      source.lastReceivedAt = item.receivedAt
    await sources.save(source)
  }
}

/** Baja, rebote o queja que avisó Resend. Contactos desconocidos se ignoran. */
async function applyStatus(manager: EntityManager, item: HubStatusItem): Promise<void> {
  const contact = await manager.getRepository(ContactModel).findOneBy({ email: item.email })
  if (!contact || contact.status === item.status) return
  // Un rebote o queja pesa más que una baja; una baja no rebaja un rebote.
  if (
    item.status === 'unsubscribed' &&
    (contact.status === 'bounced' || contact.status === 'complained')
  )
    return
  await setStatus(manager, contact, item.status, `resend:${item.event}`)
}
