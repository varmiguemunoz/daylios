import { randomUUID } from 'crypto'
import type { DataSource, EntityManager } from 'typeorm'
import {
  normalizeName,
  type Contact,
  type ContactBrief,
  type ContactDetail,
  type ContactInput
} from '@shared/consultora'
import { ContactModel } from '../models/contact.model'
import { ClientModel } from '../models/client.model'
import { ProspectModel } from '../models/prospect.model'
import { MeetingModel } from '../models/meeting.model'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { findByRef } from './ref'
import { markdown, now, optionalText, requiredText } from './fields'
import { brief } from './meeting.helpers'

/** Contactos: personas de clientes y prospectos. */
export class ContactService {
  constructor(private readonly db: DataSource) {}

  /** Lista con el nombre de su organización. Filtros: cliente, prospecto o texto (nombre, rol, email). */
  async list(filter: { client?: string; prospect?: string; query?: string }): Promise<ContactBrief[]> {
    const repo = this.db.getRepository(ContactModel)
    let contacts = await repo.find({ order: { name: 'ASC' } })

    if (filter.client) {
      const client = await findByRef(this.db.getRepository(ClientModel), filter.client, 'name', 'el cliente')
      contacts = contacts.filter((c) => c.clientId === client.id)
    }
    if (filter.prospect) {
      const prospect = await findByRef(this.db.getRepository(ProspectModel), filter.prospect, 'company', 'el prospecto')
      contacts = contacts.filter((c) => c.prospectId === prospect.id)
    }

    const named = await this.withOrganization(contacts)
    const q = normalizeName(filter.query ?? '')
    if (!q) return named
    return named.filter((c) =>
      [c.name, c.role, c.email, c.organization].some((field) => field && normalizeName(field).includes(q))
    )
  }

  /** Contacto + organización + reuniones donde aparece su nombre entre los participantes. */
  async get(id: unknown): Promise<ContactDetail> {
    const contact = await this.find(id)
    const [named] = await this.withOrganization([contact])
    const name = normalizeName(contact.name)
    const meetings = (await this.db.getRepository(MeetingModel).find({ order: { date: 'DESC' } })).filter((m) =>
      m.participants.some((p) => normalizeName(p).includes(name))
    )
    return { ...named, meetings: meetings.map(brief) }
  }

  create(input: ContactInput): Promise<Contact> {
    return transactionGuard(this.db, async (manager) => {
      const stamp = now()
      const contact: Contact = {
        id: randomUUID(),
        name: requiredText(input.name, 'El nombre'),
        role: optionalText(input.role, 'El rol', 120),
        email: optionalText(input.email, 'El email', 200),
        phone: optionalText(input.phone, 'El teléfono', 60),
        linkedin: optionalText(input.linkedin, 'LinkedIn', 300),
        notesMd: markdown(input.notesMd, 'Las notas'),
        clientId: null,
        prospectId: null,
        createdAt: stamp,
        updatedAt: stamp
      }
      await link(manager, contact, input)
      await manager.getRepository(ContactModel).insert(contact)
      return contact
    })
  }

  update(id: unknown, patch: ContactInput): Promise<Contact> {
    return transactionGuard(this.db, async (manager) => {
      const contact = await this.find(id)
      if (patch.name !== undefined) contact.name = requiredText(patch.name, 'El nombre')
      if (patch.role !== undefined) contact.role = optionalText(patch.role, 'El rol', 120)
      if (patch.email !== undefined) contact.email = optionalText(patch.email, 'El email', 200)
      if (patch.phone !== undefined) contact.phone = optionalText(patch.phone, 'El teléfono', 60)
      if (patch.linkedin !== undefined) contact.linkedin = optionalText(patch.linkedin, 'LinkedIn', 300)
      if (patch.notesMd !== undefined) contact.notesMd = markdown(patch.notesMd, 'Las notas')
      await link(manager, contact, patch)
      contact.updatedAt = now()
      return manager.getRepository(ContactModel).save(contact)
    })
  }

  async remove(id: unknown): Promise<void> {
    await transactionGuard(this.db, async (manager) => {
      const contact = await this.find(id)
      await manager.getRepository(ContactModel).delete({ id: contact.id })
    })
  }

  // ---- internos ----

  private async find(id: unknown): Promise<Contact> {
    const contact = typeof id === 'string' ? await this.db.getRepository(ContactModel).findOneBy({ id }) : null
    if (!contact) throw new AppError('not_found', 'No existe ese contacto.')
    return contact
  }

  private async withOrganization(contacts: Contact[]): Promise<ContactBrief[]> {
    const clients = await this.db.getRepository(ClientModel).find({ select: { id: true, name: true } })
    const prospects = await this.db.getRepository(ProspectModel).find({ select: { id: true, company: true } })
    return contacts.map((c) => ({
      ...c,
      organization:
        clients.find((x) => x.id === c.clientId)?.name ?? prospects.find((x) => x.id === c.prospectId)?.company ?? null
    }))
  }
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
      ? await findByRef(manager.getRepository(ProspectModel), input.prospect, 'company', 'el prospecto')
      : null
    contact.prospectId = prospect?.id ?? null
    if (prospect?.clientId && !contact.clientId) contact.clientId = prospect.clientId
  }
}
