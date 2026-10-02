import { randomUUID } from 'crypto'
import { In, type DataSource, type EntityManager } from 'typeorm'
import { slugify, type Tag, type TagRef, type TagSummary } from '@shared/marketing'
import { ContactTagModel, TagModel } from '../models/marketing.model'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { now, requiredText } from './fields'

/** Tags de contactos. El slug es la clave; el nombre es lo que se ve. */
export class TagService {
  constructor(private readonly db: DataSource) {}

  /** Todos los tags con cuántos contactos y suscritos tienen. */
  async list(): Promise<TagSummary[]> {
    const tags = await this.db.getRepository(TagModel).find({ order: { name: 'ASC' } })
    const counts: { tagId: string; contacts: number; subscribed: number }[] = await this.db
      .getRepository(ContactTagModel)
      .createQueryBuilder('ct')
      .innerJoin('Contact', 'c', 'c.id = ct.contactId')
      .select('ct.tagId', 'tagId')
      .addSelect('COUNT(*)', 'contacts')
      .addSelect("SUM(CASE WHEN c.status = 'subscribed' THEN 1 ELSE 0 END)", 'subscribed')
      .groupBy('ct.tagId')
      .getRawMany()
    return tags.map((t) => {
      const c = counts.find((x) => x.tagId === t.id)
      return { ...t, contacts: Number(c?.contacts ?? 0), subscribed: Number(c?.subscribed ?? 0) }
    })
  }

  /** Cambia el nombre visible (el slug no cambia: secuencias y segments dependen de él). */
  rename(slug: unknown, name: unknown): Promise<Tag> {
    return transactionGuard(this.db, async (manager) => {
      const repo = manager.getRepository(TagModel)
      const tag = typeof slug === 'string' ? await repo.findOneBy({ slug }) : null
      if (!tag) throw new AppError('not_found', 'No existe ese tag.')
      tag.name = requiredText(name, 'El nombre del tag', 60)
      return repo.save(tag)
    })
  }
}

/**
 * Devuelve los tags pedidos (por nombre o slug), creando los que falten.
 * Nombre de un tag nuevo = el texto tal cual lo escribieron.
 */
export async function ensureTags(manager: EntityManager, values: string[]): Promise<Tag[]> {
  const wanted = new Map<string, string>()
  for (const value of values) {
    const slug = slugify(value)
    if (!slug) throw new AppError('invalid', `«${value}» no sirve como tag.`)
    if (!wanted.has(slug)) wanted.set(slug, value.trim().slice(0, 60) || slug)
  }
  if (!wanted.size) return []

  const repo = manager.getRepository(TagModel)
  const existing = await repo.findBy({ slug: In([...wanted.keys()]) })
  const created: Tag[] = []
  for (const [slug, name] of wanted) {
    if (existing.some((t) => t.slug === slug)) continue
    created.push({ id: randomUUID(), slug, name, segmentId: null, createdAt: now() })
  }
  if (created.length) await repo.insert(created)
  return [...existing, ...created]
}

/** Tags de varios contactos: contactId → tags (ordenados por nombre). */
export async function tagsByContact(
  manager: EntityManager,
  contactIds: string[]
): Promise<Map<string, (TagRef & { id: string })[]>> {
  const out = new Map<string, (TagRef & { id: string })[]>()
  if (!contactIds.length) return out
  const links = await manager.getRepository(ContactTagModel).findBy({ contactId: In(contactIds) })
  if (!links.length) return out
  const tags = await manager
    .getRepository(TagModel)
    .findBy({ id: In([...new Set(links.map((l) => l.tagId))]) })
  for (const link of links) {
    const tag = tags.find((t) => t.id === link.tagId)
    if (!tag) continue
    const list = out.get(link.contactId) ?? []
    list.push({ id: tag.id, slug: tag.slug, name: tag.name })
    out.set(link.contactId, list)
  }
  for (const list of out.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return out
}
