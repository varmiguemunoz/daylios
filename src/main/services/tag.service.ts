import { randomUUID } from 'crypto'
import { In, type DataSource, type EntityManager } from 'typeorm'
import { slugify, type Tag, type TagRef, type TagSummary, type TagUsage } from '@shared/marketing'
import { ContactModel } from '../models/contact.model'
import { usesRef } from '@shared/automations'
import { AutomationModel } from '../models/automation.model'
import { ContactTagModel, LeadSourceModel, TagModel } from '../models/marketing.model'
import { enqueueContactSync, enqueueSegmentDelete } from './outbox'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { now, requiredText } from './fields'

export class TagService {
  constructor(
    private readonly db: DataSource,
    private readonly configChanged: () => void = () => {}
  ) {}

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

  rename(slug: unknown, name: unknown): Promise<Tag> {
    return transactionGuard(this.db, async (manager) => {
      const repo = manager.getRepository(TagModel)
      const tag = typeof slug === 'string' ? await repo.findOneBy({ slug }) : null
      if (!tag) throw new AppError('not_found', 'No existe ese tag.')
      tag.name = requiredText(name, 'El nombre del tag', 60)
      return repo.save(tag)
    })
  }

  async usage(slug: unknown): Promise<TagUsage> {
    return usageOf(this.db.manager, await findTag(this.db.manager, slug))
  }

  async setAudience(slug: unknown, audience: unknown): Promise<Tag> {
    const on = audience === true
    const tag = await transactionGuard(this.db, async (manager) => {
      const tag = await findTag(manager, slug)
      if (tag.audience === on) return tag
      tag.audience = on
      if (on) {
        for (const id of await subscribedWith(manager, tag.id))
          await enqueueContactSync(manager, id)
      } else if (tag.segmentId) {
        await enqueueSegmentDelete(manager, tag.slug, tag.segmentId)
        tag.segmentId = null
      }
      return manager.getRepository(TagModel).save(tag)
    })
    this.configChanged()
    return tag
  }

  async remove(slug: unknown): Promise<void> {
    await transactionGuard(this.db, async (manager) => {
      const tag = await findTag(manager, slug)
      const usage = await usageOf(manager, tag)
      const active = usage.automations.filter((r) => r.active)
      if (active.length) {
        throw new AppError(
          'invalid',
          `Lo usan las automatizaciones: ${active.map((r) => r.name).join(', ')}. Cámbialas o páusalas antes de borrar «${tag.name}».`
        )
      }
      const sources = manager.getRepository(LeadSourceModel)
      for (const source of await sources.find()) {
        if (!source.defaultTags.includes(tag.slug)) continue
        source.defaultTags = source.defaultTags.filter((t) => t !== tag.slug)
        source.updatedAt = now()
        await sources.save(source)
      }
      await manager.getRepository(ContactTagModel).delete({ tagId: tag.id })
      if (tag.segmentId) await enqueueSegmentDelete(manager, tag.slug, tag.segmentId)
      await manager.getRepository(TagModel).softDelete({ id: tag.id })
    })
    this.configChanged()
  }
}

async function findTag(manager: EntityManager, slug: unknown): Promise<Tag> {
  const tag =
    typeof slug === 'string' ? await manager.getRepository(TagModel).findOneBy({ slug }) : null
  if (!tag) throw new AppError('not_found', 'No existe ese tag.')
  return tag
}

async function usageOf(manager: EntityManager, tag: Tag): Promise<TagUsage> {
  const automations = (await manager.getRepository(AutomationModel).find()).filter((a) =>
    usesRef(a.draft, 'tag', tag.slug)
  )
  const sources = (await manager.getRepository(LeadSourceModel).find())
    .filter((s) => s.defaultTags.includes(tag.slug))
    .map((s) => s.name)
  return {
    slug: tag.slug,
    contacts: await manager.getRepository(ContactTagModel).countBy({ tagId: tag.id }),
    automations: automations.map((a) => ({
      id: a.id,
      name: a.name,
      active: a.status === 'active'
    })),
    sources
  }
}

async function subscribedWith(manager: EntityManager, tagId: string): Promise<string[]> {
  const links = await manager.getRepository(ContactTagModel).findBy({ tagId })
  if (!links.length) return []
  const contacts = await manager
    .getRepository(ContactModel)
    .findBy({ id: In(links.map((l) => l.contactId)), status: 'subscribed' })
  return contacts.map((c) => c.id)
}

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
    created.push({
      id: randomUUID(),
      slug,
      name,
      segmentId: null,
      audience: false,
      createdAt: now()
    })
  }
  if (created.length) await repo.insert(created)
  return [...existing, ...created]
}

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
