import { randomUUID } from 'crypto'
import type { DataSource, EntityManager } from 'typeorm'
import {
  RULE_ACTION_TYPES,
  slugify,
  type Rule,
  type RuleAction,
  type RuleInput
} from '@shared/marketing'
import { RuleModel } from '../models/marketing.model'
import { StageModel } from '../models/stage.model'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { findByRef } from './ref'
import { now, oneOf, requiredText } from './fields'
import { ensureTags } from './tag.service'

const EVENT = /^[a-zA-Z0-9._-]{1,100}$/

/**
 * Reglas por tag: «cuando entra el tag X → acciones». Las evalúan el Worker (al recibir un lead)
 * y la app (al añadir un tag a mano o desde Claude). Cambiar algo avisa para empujarlas al Worker.
 */
export class RuleService {
  constructor(
    private readonly db: DataSource,
    private readonly onChange: () => void = () => {}
  ) {}

  list(): Promise<Rule[]> {
    return this.db.getRepository(RuleModel).find({ order: { position: 'ASC', createdAt: 'ASC' } })
  }

  async create(input: RuleInput): Promise<Rule> {
    const rule = await transactionGuard(this.db, async (manager) => {
      const repo = manager.getRepository(RuleModel)
      const last = await repo.findOne({ where: {}, order: { position: 'DESC' } })
      const stamp = now()
      const rule: Rule = {
        id: randomUUID(),
        name: requiredText(input.name, 'El nombre de la regla', 120),
        position: (last?.position ?? -1) + 1,
        active: input.active ?? true,
        triggerTag: await trigger(manager, input.triggerTag),
        actions: await actions(manager, input.actions),
        createdAt: stamp,
        updatedAt: stamp
      }
      await repo.save(rule)
      return rule
    })
    this.onChange()
    return rule
  }

  async update(id: unknown, patch: RuleInput): Promise<Rule> {
    const rule = await transactionGuard(this.db, async (manager) => {
      const repo = manager.getRepository(RuleModel)
      const rule = await find(manager, id)
      if (patch.name !== undefined)
        rule.name = requiredText(patch.name, 'El nombre de la regla', 120)
      if (patch.active !== undefined) rule.active = patch.active === true
      if (patch.triggerTag !== undefined) rule.triggerTag = await trigger(manager, patch.triggerTag)
      if (patch.actions !== undefined) rule.actions = await actions(manager, patch.actions)
      rule.updatedAt = now()
      return repo.save(rule)
    })
    this.onChange()
    return rule
  }

  async remove(id: unknown): Promise<void> {
    await transactionGuard(this.db, async (manager) => {
      await manager.getRepository(RuleModel).delete({ id: (await find(manager, id)).id })
    })
    this.onChange()
  }

  /** Nuevo orden (lista completa de ids). Las reglas de un mismo tag se aplican en este orden. */
  async reorder(ids: unknown): Promise<Rule[]> {
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      throw new AppError('invalid', 'El orden debe ser una lista de ids.')
    }
    const list = await transactionGuard(this.db, async (manager) => {
      const repo = manager.getRepository(RuleModel)
      const rules = await repo.find()
      if (rules.length !== ids.length || rules.some((r) => !ids.includes(r.id))) {
        throw new AppError('invalid', 'El orden debe incluir todas las reglas.')
      }
      for (const rule of rules) rule.position = ids.indexOf(rule.id)
      await repo.save(rules)
      return rules.sort((a, b) => a.position - b.position)
    })
    this.onChange()
    return list
  }
}

async function find(manager: EntityManager, id: unknown): Promise<Rule> {
  const rule =
    typeof id === 'string' ? await manager.getRepository(RuleModel).findOneBy({ id }) : null
  if (!rule) throw new AppError('not_found', 'No existe esa regla.')
  return rule
}

/** El tag que dispara la regla (se crea si no existe, para que aparezca en los selectores). */
async function trigger(manager: EntityManager, value: unknown): Promise<string> {
  const text = requiredText(value, 'El tag que dispara la regla', 60)
  const [tag] = await ensureTags(manager, [text])
  return tag.slug
}

/** Valida y normaliza las acciones. Las etapas se guardan por id (renombrarlas no rompe la regla). */
async function actions(manager: EntityManager, value: unknown): Promise<RuleAction[]> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError('invalid', 'La regla necesita al menos una acción.')
  }
  if (value.length > 10) throw new AppError('invalid', 'Una regla admite como máximo 10 acciones.')
  const out: RuleAction[] = []
  for (const raw of value as Record<string, unknown>[]) {
    const type = oneOf(raw?.type, RULE_ACTION_TYPES, 'El tipo de acción')
    if (type === 'add_tag' || type === 'remove_tag') {
      const text = requiredText(raw.tag, 'El tag de la acción', 60)
      const slug = slugify(text)
      if (!slug) throw new AppError('invalid', `«${text}» no sirve como tag.`)
      if (type === 'add_tag') await ensureTags(manager, [text])
      out.push({ type, tag: slug })
    } else if (type === 'fire_event') {
      const event = requiredText(raw.event, 'El evento', 100)
      if (!EVENT.test(event)) {
        throw new AppError(
          'invalid',
          'El evento solo admite letras, números, puntos, guiones y guiones bajos.'
        )
      }
      out.push({ type, event })
    } else {
      const stage = typeof raw.stage === 'string' ? raw.stage.trim() : ''
      const found = stage
        ? await findByRef(manager.getRepository(StageModel), stage, 'name', 'la etapa')
        : null
      out.push({ type, stage: found?.id ?? '' })
    }
  }
  return out
}
