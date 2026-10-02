import { randomUUID } from 'crypto'
import { In, type DataSource, type EntityManager } from 'typeorm'
import {
  normalizeName,
  type Contact,
  type ContactBrief,
  type ContactDetail,
  type ContactFilter,
  type ContactInput,
  type ContactsPage,
  type Prospect
} from '@shared/consultora'
import {
  CONTACT_STATUSES,
  LEAD_CREATED,
  contactLabel,
  isEmail,
  normalizeEmail,
  slugify,
  tagEvent,
  type ContactEventType,
  type ContactFields,
  type ContactStatus,
  type FieldValue
} from '@shared/marketing'
import { runRules } from '@shared/automation'
import { ContactModel } from '../models/contact.model'
import { ClientModel } from '../models/client.model'
import { ProspectModel } from '../models/prospect.model'
import { MeetingModel } from '../models/meeting.model'
import { ContactEventModel, ContactTagModel, RuleModel, TagModel } from '../models/marketing.model'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { findByRef } from './ref'
import { markdown, now, oneOf, optionalText } from './fields'
import { brief } from './meeting.helpers'
import { ensureTags, tagsByContact } from './tag.service'
import { enqueueContactSync, enqueueEvent } from './outbox'
import { insertProspect } from './prospect.service'

const PAGE_SIZE = 50

/**
 * Contactos: personas de clientes y prospectos, y leads de email marketing (misma tabla).
 * Todo cambio que Resend deba conocer se encola en la outbox dentro de la misma transacción.
 */
export class ContactService {
  constructor(private readonly db: DataSource) {}

  /**
   * Lista paginada con organización y tags. Filtros exactos en SQL (cliente, prospecto, tag,
   * estado, fuente); el texto se compara sin acentos (nombre, rol, email, empresa).
   */
  async list(filter: ContactFilter = {}): Promise<ContactsPage> {
    const qb = this.db.getRepository(ContactModel).createQueryBuilder('c')
    if (filter.client) {
      const client = await findByRef(
        this.db.getRepository(ClientModel),
        filter.client,
        'name',
        'el cliente'
      )
      qb.andWhere('c.clientId = :client', { client: client.id })
    }
    if (filter.prospect) {
      const prospect = await findByRef(
        this.db.getRepository(ProspectModel),
        filter.prospect,
        'company',
        'el prospecto'
      )
      qb.andWhere('c.prospectId = :prospect', { prospect: prospect.id })
    }
    if (filter.tag) {
      qb.innerJoin('ContactTag', 'ct', 'ct.contactId = c.id').innerJoin(
        'Tag',
        't',
        't.id = ct.tagId AND t.slug = :tag',
        { tag: slugify(filter.tag) }
      )
    }
    if (filter.status)
      qb.andWhere('c.status = :status', {
        status: oneOf(filter.status, CONTACT_STATUSES, 'El estado')
      })
    if (filter.source) qb.andWhere('c.source = :source', { source: filter.source })

    const named = await this.withOrganization(await qb.getMany())
    const q = normalizeName(filter.query ?? '')
    const matched = q
      ? named.filter((c) =>
          [c.name, c.role, c.email, c.organization].some(
            (field) => field && normalizeName(field).includes(q)
          )
        )
      : named
    matched.sort((a, b) =>
      contactLabel(a).localeCompare(contactLabel(b), 'es', { sensitivity: 'base' })
    )

    const pageSize = Math.min(Math.max(Math.trunc(Number(filter.pageSize) || PAGE_SIZE), 1), 200)
    const totalPages = Math.max(1, Math.ceil(matched.length / pageSize))
    const page = Math.min(Math.max(Math.trunc(Number(filter.page) || 1), 1), totalPages)
    const slice = matched.slice((page - 1) * pageSize, page * pageSize)
    const tags = await tagsByContact(
      this.db.manager,
      slice.map((c) => c.id)
    )
    return {
      contacts: slice.map((c) => ({
        ...c,
        tags: (tags.get(c.id) ?? []).map(({ slug, name }) => ({ slug, name }))
      })),
      page,
      totalPages,
      total: matched.length
    }
  }

  /** Contacto + organización + tags + línea de tiempo + reuniones donde aparece su nombre. */
  async get(id: unknown): Promise<ContactDetail> {
    const contact = await this.find(this.db.manager, id)
    const [named] = await this.withOrganization([contact])
    const name = contact.name ? normalizeName(contact.name) : ''
    const meetings = name
      ? (await this.db.getRepository(MeetingModel).find({ order: { date: 'DESC' } })).filter((m) =>
          m.participants.some((p) => normalizeName(p).includes(name))
        )
      : []
    const tags = (await tagsByContact(this.db.manager, [contact.id])).get(contact.id) ?? []
    const events = await this.db
      .getRepository(ContactEventModel)
      .find({ where: { contactId: contact.id }, order: { createdAt: 'DESC' }, take: 100 })
    return {
      ...named,
      tags: tags.map(({ slug, name }) => ({ slug, name })),
      meetings: meetings.map(brief),
      events
    }
  }

  create(input: ContactInput): Promise<Contact> {
    return transactionGuard(this.db, async (manager) => {
      const stamp = now()
      const contact: Contact = {
        id: randomUUID(),
        name: optionalText(input.name, 'El nombre', 200),
        role: optionalText(input.role, 'El rol', 120),
        email: await uniqueEmail(manager, input.email, null),
        phone: optionalText(input.phone, 'El teléfono', 60),
        linkedin: optionalText(input.linkedin, 'LinkedIn', 300),
        notesMd: markdown(input.notesMd, 'Las notas'),
        clientId: null,
        prospectId: null,
        status: 'none',
        source: null,
        fields: cleanFields(input.fields),
        consentAt: null,
        syncError: null,
        syncedAt: null,
        createdAt: stamp,
        updatedAt: stamp
      }
      if (!contact.name && !contact.email)
        throw new AppError('invalid', 'Indica un nombre o un email.')
      await link(manager, contact, input)
      await manager.getRepository(ContactModel).insert(contact)
      return contact
    })
  }

  update(id: unknown, patch: ContactInput): Promise<Contact> {
    return transactionGuard(this.db, async (manager) => {
      const contact = await this.find(manager, id)
      const before = {
        name: contact.name,
        email: contact.email,
        fields: JSON.stringify(contact.fields)
      }

      if (patch.name !== undefined) contact.name = optionalText(patch.name, 'El nombre', 200)
      if (patch.role !== undefined) contact.role = optionalText(patch.role, 'El rol', 120)
      if (patch.email !== undefined)
        contact.email = await uniqueEmail(manager, patch.email, contact.id)
      if (patch.phone !== undefined) contact.phone = optionalText(patch.phone, 'El teléfono', 60)
      if (patch.linkedin !== undefined)
        contact.linkedin = optionalText(patch.linkedin, 'LinkedIn', 300)
      if (patch.notesMd !== undefined) contact.notesMd = markdown(patch.notesMd, 'Las notas')
      if (patch.fields !== undefined) contact.fields = cleanFields(patch.fields)
      if (contact.status !== 'none' && !contact.email) {
        throw new AppError(
          'invalid',
          'Este contacto está en la lista de emails: necesita un email.'
        )
      }
      if (!contact.name && !contact.email)
        throw new AppError('invalid', 'Indica un nombre o un email.')
      await link(manager, contact, patch)
      contact.updatedAt = now()
      const saved = await manager.getRepository(ContactModel).save(contact)

      const changed =
        before.name !== contact.name ||
        before.email !== contact.email ||
        before.fields !== JSON.stringify(contact.fields)
      if (contact.status !== 'none' && changed) {
        await enqueueContactSync(manager, contact.id, {
          previousEmail: before.email !== contact.email ? before.email : null
        })
      }
      return saved
    })
  }

  /** Borra el contacto, sus tags y su línea de tiempo. Si recibía emails, se da de baja en Resend. */
  async remove(id: unknown): Promise<void> {
    await transactionGuard(this.db, async (manager) => {
      const contact = await this.find(manager, id)
      await manager.getRepository(ContactTagModel).delete({ contactId: contact.id })
      await manager.getRepository(ContactEventModel).delete({ contactId: contact.id })
      await manager.getRepository(ContactModel).delete({ id: contact.id })
      if (contact.status !== 'none' && contact.email) {
        await enqueueContactSync(manager, contact.id, { previousEmail: contact.email })
      }
    })
  }

  /**
   * Suscribe a marketing con consentimiento `manual`. La primera suscripción dispara
   * `lead.created` (secuencia de bienvenida). Rebotes y quejas no se reactivan a mano.
   */
  subscribe(id: unknown): Promise<Contact> {
    return transactionGuard(this.db, async (manager) => {
      const contact = await this.find(manager, id)
      if (!contact.email)
        throw new AppError('invalid', 'Para recibir emails, el contacto necesita un email.')
      if (contact.status === 'subscribed') return contact
      if (contact.status === 'bounced' || contact.status === 'complained') {
        throw new AppError(
          'invalid',
          contact.status === 'bounced'
            ? 'Su email rebotó: no se puede volver a suscribir. Cambia el email primero.'
            : 'Marcó un email como spam: no se puede volver a suscribir.'
        )
      }
      const first = !contact.consentAt
      const resubscribe = contact.status === 'unsubscribed'
      contact.status = 'subscribed'
      contact.source ??= 'manual'
      contact.consentAt ??= now()
      contact.updatedAt = now()
      await manager.getRepository(ContactModel).save(contact)
      await logEvent(manager, contact.id, 'subscribed', { source: 'manual' })
      await enqueueContactSync(manager, contact.id, { resubscribe })
      if (first) await enqueueEvent(manager, contact.id, LEAD_CREATED, { source: contact.source })
      return contact
    })
  }

  unsubscribe(id: unknown): Promise<Contact> {
    return transactionGuard(this.db, async (manager) => {
      const contact = await this.find(manager, id)
      if (contact.status !== 'subscribed') return contact
      await setStatus(manager, contact, 'unsubscribed', 'manual')
      return contact
    })
  }

  /**
   * Añade y/o quita tags. Los añadidos disparan las reglas (que pueden añadir o quitar más,
   * disparar eventos o pasar a pipeline). Si el contacto está suscrito, cada tag nuevo
   * dispara `tag.<slug>` en Resend.
   */
  tag(id: unknown, change: { add?: unknown; remove?: unknown }): Promise<ContactBrief> {
    return transactionGuard(this.db, async (manager) => {
      const contact = await this.find(manager, id)
      await changeTags(manager, contact, {
        add: textList(change.add, 'add'),
        remove: textList(change.remove, 'remove'),
        rules: true
      })
      const [named] = await this.withOrganization([contact])
      const tags = (await tagsByContact(manager, [contact.id])).get(contact.id) ?? []
      return { ...named, tags: tags.map(({ slug, name }) => ({ slug, name })) }
    })
  }

  /** Pasa a pipeline: crea un prospecto con sus datos y lo enlaza. Uno por contacto. */
  promote(id: unknown, stage?: unknown): Promise<{ contact: Contact; prospect: Prospect }> {
    return transactionGuard(this.db, async (manager) => {
      const contact = await this.find(manager, id)
      const prospect = await promoteContact(
        manager,
        contact,
        typeof stage === 'string' ? stage : ''
      )
      return { contact, prospect }
    })
  }

  // ---- internos ----

  private async find(manager: EntityManager, id: unknown): Promise<Contact> {
    const contact =
      typeof id === 'string' ? await manager.getRepository(ContactModel).findOneBy({ id }) : null
    if (!contact) throw new AppError('not_found', 'No existe ese contacto.')
    return contact
  }

  private async withOrganization(
    contacts: Contact[]
  ): Promise<(Contact & { organization: string | null })[]> {
    const clients = await this.db
      .getRepository(ClientModel)
      .find({ select: { id: true, name: true } })
    const prospects = await this.db
      .getRepository(ProspectModel)
      .find({ select: { id: true, company: true } })
    return contacts.map((c) => ({
      ...c,
      organization:
        clients.find((x) => x.id === c.clientId)?.name ??
        prospects.find((x) => x.id === c.prospectId)?.company ??
        null
    }))
  }
}

// ---- Piezas compartidas con la ingesta del hub (marketing-sync) ----

/** Deja un evento en la línea de tiempo del contacto. */
export async function logEvent(
  manager: EntityManager,
  contactId: string,
  type: ContactEventType,
  detail: Record<string, FieldValue> = {}
): Promise<void> {
  await manager
    .getRepository(ContactEventModel)
    .insert({ id: randomUUID(), contactId, type, detail, createdAt: now() })
}

/** Cambia el estado de suscripción, lo anota y avisa a Resend. */
export async function setStatus(
  manager: EntityManager,
  contact: Contact,
  status: ContactStatus,
  origin: string
): Promise<void> {
  if (contact.status === status) return
  contact.status = status
  contact.updatedAt = now()
  await manager.getRepository(ContactModel).save(contact)
  await logEvent(manager, contact.id, 'status', { status, origin })
  await enqueueContactSync(manager, contact.id)
}

/**
 * Aplica un cambio de tags. Con `rules: true` evalúa las reglas sobre los añadidos.
 * `remoteDone: true` = el Worker ya avisó a Resend (no se vuelven a disparar eventos).
 */
export async function changeTags(
  manager: EntityManager,
  contact: Contact,
  change: {
    add: string[]
    remove: string[]
    rules: boolean
    remoteDone?: boolean
    extraEvents?: string[]
  }
): Promise<{ added: string[]; removed: string[] }> {
  const links = manager.getRepository(ContactTagModel)
  const current = await ensureTagsOf(manager, contact.id)
  const removeSlugs = change.remove.map(slugify).filter(Boolean)
  const afterRemove = current.filter((slug) => !removeSlugs.includes(slug))

  // Los tags nuevos se crean antes de las reglas para conservar el nombre tal cual se escribió.
  const incoming = (await ensureTags(manager, change.add))
    .map((t) => t.slug)
    .filter((s) => !afterRemove.includes(s))
  const rules = change.rules ? await manager.getRepository(RuleModel).find() : []
  const outcome = runRules(rules, afterRemove, incoming)

  const finalTags = outcome.tags
  const added = finalTags.filter((s) => !current.includes(s))
  const removed = current.filter((s) => !finalTags.includes(s))

  const tags = await ensureTags(manager, finalTags)
  const bySlug = new Map(tags.map((t) => [t.slug, t]))
  if (removed.length) {
    const removedTags = await manager.getRepository(TagModel).findBy({ slug: In(removed) })
    await links.delete({ contactId: contact.id, tagId: In(removedTags.map((t) => t.id)) })
  }
  for (const slug of added) {
    await links.insert({ contactId: contact.id, tagId: bySlug.get(slug)!.id, createdAt: now() })
    await logEvent(manager, contact.id, 'tag_added', { tag: slug })
  }
  for (const slug of removed) await logEvent(manager, contact.id, 'tag_removed', { tag: slug })

  if ((added.length || removed.length) && contact.status !== 'none' && !change.remoteDone) {
    await enqueueContactSync(manager, contact.id)
  }
  if (contact.status === 'subscribed' && !change.remoteDone) {
    for (const slug of added) await enqueueEvent(manager, contact.id, tagEvent(slug))
    for (const event of [...outcome.events, ...(change.extraEvents ?? [])])
      await enqueueEvent(manager, contact.id, event)
  }
  if (outcome.promote !== null && !contact.prospectId)
    await promoteContact(manager, contact, outcome.promote)
  return { added, removed }
}

/** Crea el prospecto de un contacto y lo enlaza (falla si ya está en el pipeline). */
export async function promoteContact(
  manager: EntityManager,
  contact: Contact,
  stage: string
): Promise<Prospect> {
  if (contact.prospectId) throw new AppError('invalid', 'Este contacto ya está en el pipeline.')
  const company = typeof contact.fields.company === 'string' && contact.fields.company.trim()
  const prospect = await insertProspect(manager, {
    company: company || contactLabel(contact),
    contactMd: [
      contact.name && `- Nombre: ${contact.name}`,
      contact.email && `- Email: ${contact.email}`,
      contact.phone && `- Teléfono: ${contact.phone}`
    ]
      .filter(Boolean)
      .join('\n'),
    source: contact.source,
    stage: stage || undefined
  })
  contact.prospectId = prospect.id
  contact.updatedAt = now()
  await manager.getRepository(ContactModel).save(contact)
  await logEvent(manager, contact.id, 'promoted', {
    prospectId: prospect.id,
    company: prospect.company
  })
  return prospect
}

/** Slugs actuales de un contacto. */
async function ensureTagsOf(manager: EntityManager, contactId: string): Promise<string[]> {
  return ((await tagsByContact(manager, [contactId])).get(contactId) ?? []).map((t) => t.slug)
}

/** Email limpio (minúsculas), válido y sin repetir entre contactos. Vacío = null. */
export async function uniqueEmail(
  manager: EntityManager,
  value: unknown,
  selfId: string | null
): Promise<string | null> {
  const raw = optionalText(value, 'El email', 254)
  if (!raw) return null
  const email = normalizeEmail(raw)
  if (!isEmail(email)) throw new AppError('invalid', `«${raw}» no es un email válido.`)
  const other = await manager.getRepository(ContactModel).findOneBy({ email })
  if (other && other.id !== selfId) {
    throw new AppError('invalid', `Ya existe un contacto con ese email (${contactLabel(other)}).`)
  }
  return email
}

/** Campos libres: objeto plano con valores simples. */
export function cleanFields(value: unknown): ContactFields {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object' || Array.isArray(value))
    throw new AppError('invalid', 'Los campos deben ser un objeto.')
  const out: ContactFields = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      out[k.slice(0, 60)] = v
    else throw new AppError('invalid', `El campo «${k}» debe ser texto, número o booleano.`)
  }
  return out
}

function textList(value: unknown, label: string): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new AppError('invalid', `«${label}» debe ser una lista de tags.`)
  }
  return value as string[]
}

/** Aplica `client` / `prospect` (id o nombre; '' quita). Un prospecto ya ganado fija también su cliente. */
async function link(manager: EntityManager, contact: Contact, input: ContactInput): Promise<void> {
  if (input.client !== undefined) {
    contact.clientId = input.client
      ? (await findByRef(manager.getRepository(ClientModel), input.client, 'name', 'el cliente')).id
      : null
  }
  if (input.prospect !== undefined) {
    const prospect = input.prospect
      ? await findByRef(
          manager.getRepository(ProspectModel),
          input.prospect,
          'company',
          'el prospecto'
        )
      : null
    contact.prospectId = prospect?.id ?? null
    if (prospect?.clientId && !contact.clientId) contact.clientId = prospect.clientId
  }
}
