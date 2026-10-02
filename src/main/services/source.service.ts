import { randomBytes, randomUUID } from 'crypto'
import type { DataSource, Repository } from 'typeorm'
import { cleanTags, slugify, type LeadSource, type LeadSourceInput } from '@shared/marketing'
import { LeadSourceModel } from '../models/marketing.model'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { now, requiredText } from './fields'

/** Slugs que no puede usar una fuente (`manual` = alta a mano). */
const RESERVED = ['manual']

/**
 * Fuentes de leads (webhooks de entrada). Cada una tiene su URL `/in/<slug>` en el Worker y su
 * secreto. Cambiar algo avisa (`onChange`) para empujar la config al Worker.
 */
export class SourceService {
  constructor(
    private readonly db: DataSource,
    private readonly onChange: () => void = () => {}
  ) {}

  list(): Promise<LeadSource[]> {
    return this.db.getRepository(LeadSourceModel).find({ order: { name: 'ASC' } })
  }

  async create(input: LeadSourceInput): Promise<LeadSource> {
    const source = await transactionGuard(this.db, async (manager) => {
      const repo = manager.getRepository(LeadSourceModel)
      const name = requiredText(input.name, 'El nombre de la fuente', 80)
      const slug = slugify(input.slug?.trim() || name)
      if (!slug) throw new AppError('invalid', 'El nombre debe tener letras o números.')
      if (RESERVED.includes(slug))
        throw new AppError('invalid', `«${slug}» está reservado. Elige otro nombre.`)
      if (await repo.findOneBy({ slug }))
        throw new AppError('invalid', `Ya hay una fuente «${slug}».`)
      const stamp = now()
      const created: LeadSource = {
        id: randomUUID(),
        slug,
        name,
        secret: newSecret(),
        defaultTags: tags(input.defaultTags),
        receivedCount: 0,
        lastReceivedAt: null,
        createdAt: stamp,
        updatedAt: stamp
      }
      await repo.save(created)
      return created
    })
    this.onChange()
    return source
  }

  /** Cambia nombre y tags por defecto. El slug (la URL) no cambia. */
  async update(slug: unknown, patch: LeadSourceInput): Promise<LeadSource> {
    const source = await transactionGuard(this.db, async (manager) => {
      const repo = manager.getRepository(LeadSourceModel)
      const s = await find(repo, slug)
      if (patch.name !== undefined) s.name = requiredText(patch.name, 'El nombre de la fuente', 80)
      if (patch.defaultTags !== undefined) s.defaultTags = tags(patch.defaultTags)
      s.updatedAt = now()
      return repo.save(s)
    })
    this.onChange()
    return source
  }

  /** Genera un secreto nuevo: el anterior deja de funcionar al empujar la config. */
  async rotateSecret(slug: unknown): Promise<LeadSource> {
    const source = await transactionGuard(this.db, async (manager) => {
      const repo = manager.getRepository(LeadSourceModel)
      const s = await find(repo, slug)
      s.secret = newSecret()
      s.updatedAt = now()
      return repo.save(s)
    })
    this.onChange()
    return source
  }

  /** Borra la fuente (sus contactos se quedan; su URL deja de aceptar leads). */
  async remove(slug: unknown): Promise<void> {
    await transactionGuard(this.db, async (manager) => {
      const repo = manager.getRepository(LeadSourceModel)
      await repo.delete({ id: (await find(repo, slug)).id })
    })
    this.onChange()
  }
}

const newSecret = (): string => randomBytes(24).toString('base64url')

function tags(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value))
    throw new AppError('invalid', 'Los tags por defecto deben ser una lista.')
  return cleanTags(value).slice(0, 20)
}

async function find(repo: Repository<LeadSource>, slug: unknown): Promise<LeadSource> {
  const s = typeof slug === 'string' ? await repo.findOneBy({ slug }) : null
  if (!s) throw new AppError('not_found', 'No existe esa fuente.')
  return s
}
