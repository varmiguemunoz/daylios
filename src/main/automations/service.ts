import { randomUUID } from 'crypto'
import {
  In,
  type DataSource,
  type EntityManager,
  type EntityTarget,
  type ObjectLiteral
} from 'typeorm'
import {
  MAX_VERSIONS,
  NODE_TYPES,
  SUBJECT_TYPES,
  TRIGGER_TYPES,
  branchesOf,
  describeDefinition,
  describeNode,
  emptyDefinition,
  evaluate,
  isDestructive,
  mainPort,
  MET_PORT,
  nodeSpec,
  pickBranch,
  render,
  str,
  upstream,
  usesRef,
  validateDefinition,
  type AutomationDetail,
  type AutomationOptions,
  type AutomationRun,
  type AutomationSummary,
  type AutomationsApi,
  type ConditionGroup,
  type Definition,
  type Names,
  type NodeStats,
  type Origin,
  type RefTarget,
  type Refs,
  type RunDetail,
  type RunFilter,
  type RunStep,
  type RunView,
  type StepFilter,
  type SubjectOption,
  type SubjectType,
  type TestResult,
  type TestStep,
  type TriggerLogEntry,
  type VersionBrief
} from '@shared/automations'
import { normalizeName } from '@shared/consultora'
import { contactLabel } from '@shared/marketing'
import { transactionGuard } from '../guards/transaction.guard'
import {
  AutomationModel,
  AutomationRunModel,
  AutomationVersionModel,
  RunStepModel,
  TriggerLogModel,
  type AutomationRow
} from '../models/automation.model'
import { ClientModel } from '../models/client.model'
import { ContactModel } from '../models/contact.model'
import { MeetingModel } from '../models/meeting.model'
import { PipelineModel } from '../models/pipeline.model'
import { ProjectModel } from '../models/project.model'
import { ProspectModel } from '../models/prospect.model'
import { StageModel } from '../models/stage.model'
import { TaskModel } from '../models/task.model'
import { TagModel } from '../models/marketing.model'
import { AppError } from '../services/app.error'
import { requiredText } from '../services/fields'
import { emit } from './events'
import { loadScope } from './scope'

export interface ServiceDeps {
  db: DataSource
  kick(): void
  invalidate(): void
  onChange?(): void
  userId?(): string | null
  origin?(): Origin
}

const DAY_MS = 24 * 60 * 60_000

function parseDefinition(value: unknown, subject: SubjectType): Definition {
  if (!value || typeof value !== 'object')
    throw new AppError('invalid', 'La definición no es válida.')
  const def = value as Definition
  if (def.subject !== subject)
    throw new AppError('invalid', 'No se puede cambiar el tipo de sujeto.')
  if (!Array.isArray(def.triggers) || typeof def.nodes !== 'object' || def.nodes === null)
    throw new AppError('invalid', 'La definición no es válida.')
  for (const t of def.triggers)
    if (!TRIGGER_TYPES.includes(t?.type))
      throw new AppError('invalid', 'Hay un trigger desconocido.')
  for (const n of Object.values(def.nodes))
    if (!NODE_TYPES.includes(n?.type)) throw new AppError('invalid', 'Hay un paso desconocido.')
  const reentry = def.settings?.reentry === 'never' ? 'never' : 'allow'
  return { ...def, settings: { reentry, window: def.settings?.window ?? null } }
}

export class AutomationService implements AutomationsApi {
  constructor(private readonly deps: ServiceDeps) {}

  private get db(): DataSource {
    return this.deps.db
  }

  private changed(): void {
    this.deps.invalidate()
    this.deps.onChange?.()
    this.deps.kick()
  }

  private async find(manager: EntityManager, id: unknown): Promise<AutomationRow> {
    const row =
      typeof id === 'string' ? await manager.getRepository(AutomationModel).findOneBy({ id }) : null
    if (!row) throw new AppError('not_found', 'No existe esa automatización.')
    return row
  }

  async refs(manager: EntityManager = this.db.manager): Promise<Refs> {
    const ids = async (model: EntityTarget<ObjectLiteral>): Promise<Set<string>> =>
      new Set(((await manager.getRepository(model).find()) as { id: string }[]).map((r) => r.id))
    return {
      pipeline: await ids(PipelineModel),
      stage: await ids(StageModel),
      client: await ids(ClientModel),
      project: await ids(ProjectModel)
    }
  }

  async names(def?: Definition, manager: EntityManager = this.db.manager): Promise<Names> {
    const map = async (
      model: EntityTarget<ObjectLiteral>,
      key = 'id'
    ): Promise<Map<string, string>> => {
      const rows = (await manager.getRepository(model).find()) as Record<string, string>[]
      return new Map(rows.map((r) => [r[key], r.name]))
    }
    const tables = {
      tag: await map(TagModel, 'slug'),
      pipeline: await map(PipelineModel),
      stage: await map(StageModel),
      client: await map(ClientModel),
      project: await map(ProjectModel)
    }
    return (kind, id) => (kind === 'node' ? def?.nodes[id]?.name : tables[kind].get(id))
  }

  private async detail(manager: EntityManager, row: AutomationRow): Promise<AutomationDetail> {
    const version = row.versionId
      ? await manager.getRepository(AutomationVersionModel).findOneBy({ id: row.versionId })
      : null
    return {
      automation: {
        id: row.id,
        name: row.name,
        status: row.status,
        draft: row.draft,
        versionId: row.versionId,
        versionNumber: row.versionNumber ?? null,
        destructive: row.destructive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      },
      issues: validateDefinition(row.draft, await this.refs(manager)),
      hasDraftChanges: !version || JSON.stringify(version.definition) !== JSON.stringify(row.draft)
    }
  }

  async list(): Promise<AutomationSummary[]> {
    const rows = await this.db.getRepository(AutomationModel).find({ order: { updatedAt: 'DESC' } })
    if (rows.length === 0) return []
    const counts = (await this.db.query(
      `SELECT automation_id AS id, status, COUNT(*) AS n FROM automation_runs GROUP BY automation_id, status`
    )) as { id: string; status: string; n: number }[]
    const since = new Date(Date.now() - DAY_MS).toISOString()
    const recent = (await this.db.query(
      `SELECT automation_id AS id, COUNT(*) AS n FROM automation_runs WHERE status = 'failed' AND updated_at >= ? GROUP BY automation_id`,
      [since]
    )) as { id: string; n: number }[]
    const versions = await this.db
      .getRepository(AutomationVersionModel)
      .findBy({ id: In(rows.map((r) => r.versionId).filter((v): v is string => !!v)) })
    const byVersion = new Map(versions.map((v) => [v.id, v.definition]))
    const refs = await this.refs()
    const base = await this.names()
    const out: AutomationSummary[] = []
    for (const row of rows) {
      const names: Names = (kind, id) =>
        kind === 'node' ? row.draft.nodes[id]?.name : base(kind, id)
      const of = (status: string): number =>
        Number(counts.find((c) => c.id === row.id && c.status === status)?.n ?? 0)
      const published = row.versionId ? byVersion.get(row.versionId) : undefined
      out.push({
        id: row.id,
        name: row.name,
        subject: row.draft.subject,
        status: row.status,
        versionNumber: row.versionNumber ?? null,
        destructive: row.destructive,
        sentence: describeDefinition(published ?? row.draft, names),
        issues: validateDefinition(row.draft, refs).length,
        hasDraftChanges: !published || JSON.stringify(published) !== JSON.stringify(row.draft),
        counts: {
          active: of('active'),
          waiting: of('waiting'),
          finished: of('finished'),
          failed: of('failed'),
          failedRecent: Number(recent.find((r) => r.id === row.id)?.n ?? 0)
        },
        updatedAt: row.updatedAt
      })
    }
    return out
  }

  async get(id: string): Promise<AutomationDetail> {
    return this.detail(this.db.manager, await this.find(this.db.manager, id))
  }

  async create(input: { name: string; subject: SubjectType }): Promise<AutomationDetail> {
    const name = requiredText(input?.name, 'El nombre', 120)
    if (!SUBJECT_TYPES.includes(input?.subject))
      throw new AppError('invalid', 'El tipo de sujeto no existe.')
    const detail = await transactionGuard(this.db, async (manager) => {
      const stamp = new Date().toISOString()
      const row: AutomationRow = {
        id: randomUUID(),
        name,
        status: 'draft',
        draft: emptyDefinition(input.subject),
        versionId: null,
        versionNumber: null,
        destructive: false,
        createdAt: stamp,
        updatedAt: stamp
      }
      await manager.getRepository(AutomationModel).save(row)
      return this.detail(manager, row)
    })
    this.changed()
    return detail
  }

  async rename(id: string, name: string): Promise<AutomationDetail> {
    const detail = await transactionGuard(this.db, async (manager) => {
      const row = await this.find(manager, id)
      row.name = requiredText(name, 'El nombre', 120)
      row.updatedAt = new Date().toISOString()
      await manager.getRepository(AutomationModel).save(row)
      return this.detail(manager, row)
    })
    this.changed()
    return detail
  }

  async saveDraft(id: string, definition: Definition): Promise<AutomationDetail> {
    const detail = await transactionGuard(this.db, async (manager) => {
      const row = await this.find(manager, id)
      row.draft = parseDefinition(definition, row.draft.subject)
      row.updatedAt = new Date().toISOString()
      await manager.getRepository(AutomationModel).save(row)
      return this.detail(manager, row)
    })
    this.deps.onChange?.()
    return detail
  }

  async publish(
    id: string,
    options: { acknowledgeDestructive?: boolean } = {}
  ): Promise<AutomationDetail> {
    const detail = await transactionGuard(this.db, async (manager) => {
      const row = await this.find(manager, id)
      const issues = validateDefinition(row.draft, await this.refs(manager))
      if (issues.length)
        throw new AppError(
          'invalid',
          `No se puede publicar: ${issues.length} error(es). ${issues[0].message}`
        )
      const destructive = isDestructive(row.draft)
      if (destructive && !options.acknowledgeDestructive)
        throw new AppError(
          'invalid',
          'Esta automatización borra registros: confirma «Entiendo que borra registros».'
        )
      const versions = manager.getRepository(AutomationVersionModel)
      const last = await versions.findOne({
        where: { automationId: row.id },
        order: { number: 'DESC' }
      })
      const stamp = new Date().toISOString()
      const version = {
        id: randomUUID(),
        automationId: row.id,
        number: (last?.number ?? 0) + 1,
        definition: row.draft,
        publishedAt: stamp,
        publishedBy: this.deps.userId?.() ?? null,
        createdAt: stamp,
        updatedAt: stamp
      }
      await versions.save(version)
      const old = await versions.find({
        where: { automationId: row.id },
        order: { number: 'DESC' },
        skip: MAX_VERSIONS
      })
      const inUse = new Set(
        (
          (await manager.query(
            `SELECT DISTINCT version_id AS id FROM automation_runs WHERE automation_id = ? AND status IN ('active', 'waiting')`,
            [row.id]
          )) as { id: string }[]
        ).map((r) => r.id)
      )
      const prunable = old.filter((v) => !inUse.has(v.id)).map((v) => v.id)
      if (prunable.length) await versions.delete({ id: In(prunable) })
      row.versionId = version.id
      row.versionNumber = version.number
      row.destructive = destructive
      row.status = 'active'
      row.updatedAt = stamp
      await manager.getRepository(AutomationModel).save(row)
      return this.detail(manager, row)
    })
    this.changed()
    return detail
  }

  async versions(id: string): Promise<VersionBrief[]> {
    const row = await this.find(this.db.manager, id)
    const list = await this.db
      .getRepository(AutomationVersionModel)
      .find({ where: { automationId: row.id }, order: { number: 'DESC' } })
    return list.map((v) => ({
      id: v.id,
      number: v.number,
      publishedAt: v.publishedAt,
      publishedBy: v.publishedBy,
      current: v.id === row.versionId
    }))
  }

  async restore(id: string, versionId: string): Promise<AutomationDetail> {
    const detail = await transactionGuard(this.db, async (manager) => {
      const row = await this.find(manager, id)
      const version = await manager
        .getRepository(AutomationVersionModel)
        .findOneBy({ id: versionId, automationId: row.id })
      if (!version) throw new AppError('not_found', 'No existe esa versión.')
      row.draft = version.definition
      row.updatedAt = new Date().toISOString()
      await manager.getRepository(AutomationModel).save(row)
      return this.detail(manager, row)
    })
    this.deps.onChange?.()
    return detail
  }

  async setStatus(id: string, status: 'active' | 'paused'): Promise<AutomationDetail> {
    if (status !== 'active' && status !== 'paused')
      throw new AppError('invalid', 'El estado debe ser active o paused.')
    const detail = await transactionGuard(this.db, async (manager) => {
      const row = await this.find(manager, id)
      if (status === 'active' && !row.versionId)
        throw new AppError('invalid', 'Publica la automatización antes de activarla.')
      row.status = status
      row.updatedAt = new Date().toISOString()
      await manager.getRepository(AutomationModel).save(row)
      return this.detail(manager, row)
    })
    this.changed()
    return detail
  }

  async remove(id: string): Promise<void> {
    await transactionGuard(this.db, async (manager) => {
      const row = await this.find(manager, id)
      const stamp = new Date().toISOString()
      await manager.getRepository(AutomationRunModel).update(
        { automationId: row.id, status: In(['active', 'waiting']) },
        {
          status: 'cancelled',
          reason: 'Se borró la automatización.',
          nextAt: null,
          finishedAt: stamp,
          updatedAt: stamp
        }
      )
      await manager.getRepository(AutomationModel).softDelete({ id: row.id })
    })
    this.changed()
  }

  private async labels(
    runs: { subjectType: SubjectType; subjectId: string | null }[]
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    const group = (type: SubjectType): string[] => [
      ...new Set(
        runs.filter((r) => r.subjectType === type && r.subjectId).map((r) => r.subjectId as string)
      )
    ]
    const contacts = group('contact')
    if (contacts.length)
      for (const c of await this.db
        .getRepository(ContactModel)
        .find({ where: { id: In(contacts) }, withDeleted: true }))
        out.set(c.id, contactLabel(c))
    const prospects = group('prospect')
    if (prospects.length)
      for (const p of await this.db
        .getRepository(ProspectModel)
        .find({ where: { id: In(prospects) }, withDeleted: true }))
        out.set(p.id, p.company)
    const clients = group('client')
    if (clients.length)
      for (const c of await this.db
        .getRepository(ClientModel)
        .find({ where: { id: In(clients) }, withDeleted: true }))
        out.set(c.id, c.name)
    const tasks = group('task')
    if (tasks.length)
      for (const t of await this.db.getRepository(TaskModel).findBy({ id: In(tasks) }))
        out.set(t.id, t.title)
    const meetings = group('meeting')
    if (meetings.length)
      for (const m of await this.db
        .getRepository(MeetingModel)
        .find({ where: { id: In(meetings) }, withDeleted: true }))
        out.set(m.id, m.title)
    return out
  }

  private async views(runs: AutomationRun[]): Promise<RunView[]> {
    const labels = await this.labels(runs)
    const ids = [...new Set(runs.map((r) => r.automationId))]
    const autos = ids.length
      ? await this.db
          .getRepository(AutomationModel)
          .find({ where: { id: In(ids) }, withDeleted: true })
      : []
    const versionIds = [...new Set(runs.map((r) => r.versionId))]
    const versions = versionIds.length
      ? await this.db.getRepository(AutomationVersionModel).findBy({ id: In(versionIds) })
      : []
    const defs = new Map(versions.map((v) => [v.id, v.definition]))
    return runs.map((run) => ({
      ...run,
      subjectLabel: run.subjectId ? (labels.get(run.subjectId) ?? null) : null,
      nodeName: run.nodeId ? (defs.get(run.versionId)?.nodes[run.nodeId]?.name ?? null) : null,
      automationName: autos.find((a) => a.id === run.automationId)?.name ?? ''
    }))
  }

  async runs(filter: RunFilter = {}): Promise<RunView[]> {
    const runs = await this.db.getRepository(AutomationRunModel).find({
      where: {
        ...(filter.automationId ? { automationId: filter.automationId } : {}),
        ...(filter.subjectId ? { subjectId: filter.subjectId } : {}),
        ...(filter.status ? { status: filter.status } : {})
      },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(filter.limit ?? 50, 1), 200),
      skip: Math.max(filter.offset ?? 0, 0)
    })
    return this.views(runs)
  }

  async run(id: string): Promise<RunDetail> {
    const run = await this.db.getRepository(AutomationRunModel).findOneBy({ id })
    if (!run) throw new AppError('not_found', 'No existe esa ejecución.')
    const [view] = await this.views([run])
    const steps = await this.db
      .getRepository(RunStepModel)
      .find({ where: { runId: id }, order: { startedAt: 'ASC' } })
    return { run: view, steps }
  }

  async steps(filter: StepFilter): Promise<RunStep[]> {
    return this.db.getRepository(RunStepModel).find({
      where: {
        automationId: filter.automationId,
        ...(filter.nodeId ? { nodeId: filter.nodeId } : {}),
        ...(filter.status ? { status: filter.status } : {})
      },
      order: { startedAt: 'DESC' },
      take: Math.min(Math.max(filter.limit ?? 100, 1), 500)
    })
  }

  async triggerLog(automationId: string, limit = 100): Promise<TriggerLogEntry[]> {
    return this.db.getRepository(TriggerLogModel).find({
      where: { automationId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500)
    })
  }

  async stats(automationId: string): Promise<NodeStats> {
    const out: NodeStats = {}
    const slot = (id: string): NodeStats[string] =>
      (out[id] ??= { ok: 0, skipped: 0, failed: 0, waitingHere: 0, failedHere: 0 })
    const steps = (await this.db.query(
      `SELECT node_id AS id, status, COUNT(*) AS n FROM automation_run_steps WHERE automation_id = ? GROUP BY node_id, status`,
      [automationId]
    )) as { id: string; status: string; n: number }[]
    for (const s of steps) {
      if (s.status === 'ok') slot(s.id).ok += Number(s.n)
      else if (s.status === 'skipped') slot(s.id).skipped += Number(s.n)
      else if (s.status === 'failed') slot(s.id).failed += Number(s.n)
    }
    const here = (await this.db.query(
      `SELECT node_id AS id, status, COUNT(*) AS n FROM automation_runs WHERE automation_id = ? AND node_id IS NOT NULL AND status IN ('waiting', 'failed') GROUP BY node_id, status`,
      [automationId]
    )) as { id: string; status: string; n: number }[]
    for (const h of here) {
      if (h.status === 'waiting') slot(h.id).waitingHere += Number(h.n)
      else slot(h.id).failedHere += Number(h.n)
    }
    return out
  }

  private async mutateRun(
    runId: string,
    work: (manager: EntityManager, run: AutomationRun) => Promise<void>
  ): Promise<RunView> {
    await transactionGuard(this.db, async (manager) => {
      const run = await manager.getRepository(AutomationRunModel).findOneBy({ id: runId })
      if (!run) throw new AppError('not_found', 'No existe esa ejecución.')
      await work(manager, run)
    })
    this.deps.onChange?.()
    this.deps.kick()
    return (await this.run(runId)).run
  }

  private origin(): Origin {
    return this.deps.origin?.() ?? 'user'
  }

  cancel(runId: string): Promise<RunView> {
    return this.mutateRun(runId, async (manager, run) => {
      if (run.status !== 'active' && run.status !== 'waiting')
        throw new AppError('invalid', 'Esa ejecución ya terminó.')
      const stamp = new Date().toISOString()
      await manager.getRepository(AutomationRunModel).save({
        ...run,
        status: 'cancelled',
        reason: `Cancelada a mano (${this.origin()}).`,
        nextAt: null,
        wait: null,
        finishedAt: stamp,
        updatedAt: stamp
      })
    })
  }

  resume(runId: string): Promise<RunView> {
    return this.mutateRun(runId, async (manager, run) => {
      if (run.status !== 'waiting' || !run.nodeId)
        throw new AppError('invalid', 'Esa ejecución no está esperando.')
      const version = await manager
        .getRepository(AutomationVersionModel)
        .findOneBy({ id: run.versionId })
      const node = version?.definition.nodes[run.nodeId]
      if (!node) throw new AppError('invalid', 'El paso ya no existe.')
      const stamp = new Date().toISOString()
      const port =
        node.type === 'wait' && str(node.params, 'mode') === 'condition' ? MET_PORT : mainPort(node)
      const next = port ? (node.next[port] ?? null) : null
      if (run.wait?.kind === 'time' || run.wait?.kind === 'condition') {
        await manager
          .getRepository(RunStepModel)
          .update(
            { runId: run.id, nodeId: node.id, status: 'waiting' },
            { status: 'ok', endedAt: stamp, message: `Reanudada a mano (${this.origin()}).` }
          )
        await manager.getRepository(AutomationRunModel).save({
          ...run,
          status: next ? 'active' : 'finished',
          nodeId: next,
          wait: null,
          nextAt: next ? stamp : null,
          finishedAt: next ? null : stamp,
          updatedAt: stamp
        })
        return
      }
      await manager
        .getRepository(AutomationRunModel)
        .save({ ...run, nextAt: stamp, updatedAt: stamp })
    })
  }

  retry(runId: string): Promise<RunView> {
    return this.mutateRun(runId, async (manager, run) => {
      if (run.status !== 'failed' || !run.nodeId)
        throw new AppError('invalid', 'Solo se reintenta una ejecución fallida.')
      if (run.subjectId) {
        const open = await manager.getRepository(AutomationRunModel).countBy({
          automationId: run.automationId,
          subjectId: run.subjectId,
          status: In(['active', 'waiting'])
        })
        if (open)
          throw new AppError(
            'conflict',
            'Ese sujeto ya tiene otra ejecución abierta en esta automatización.'
          )
      }
      const stamp = new Date().toISOString()
      await manager.getRepository(AutomationRunModel).save({
        ...run,
        status: 'active',
        attempts: 0,
        reason: null,
        wait: null,
        nextAt: stamp,
        finishedAt: null,
        updatedAt: stamp
      })
    })
  }

  async retryNode(automationId: string, nodeId: string): Promise<number> {
    const failed = await this.db
      .getRepository(AutomationRunModel)
      .findBy({ automationId, nodeId, status: 'failed' })
    let count = 0
    for (const run of failed) {
      try {
        await this.retry(run.id)
        count++
      } catch {
        continue
      }
    }
    return count
  }

  async test(input: {
    id?: string
    definition?: Definition
    subjectId: string | null
  }): Promise<TestResult> {
    let def: Definition
    if (input.definition) def = input.definition
    else def = (await this.find(this.db.manager, input.id)).draft
    const names = await this.names(def)
    const event = {
      id: 'test',
      type: 'manual' as const,
      subject: { type: def.subject, id: input.subjectId },
      payload: {},
      createdAt: new Date().toISOString()
    }
    const outputs: Record<string, Record<string, unknown>> = {}
    const scope = await loadScope(
      this.db.manager,
      {
        subjectType: def.subject,
        subjectId: def.subject === 'none' ? null : input.subjectId,
        event,
        outputs
      },
      new Date()
    )
    const label =
      def.subject !== 'none' && input.subjectId
        ? ((await this.labels([{ subjectType: def.subject, subjectId: input.subjectId }])).get(
            input.subjectId
          ) ?? null)
        : null
    const matchedTrigger = def.triggers.some(
      (t) => !t.conditions?.length || evaluate(t.conditions, scope)
    )
    const steps: TestStep[] = []
    const seen = new Set<string>()
    let current = def.root
    while (current && def.nodes[current] && !seen.has(current) && steps.length < 100) {
      seen.add(current)
      const node = def.nodes[current]
      const spec = nodeSpec(node.type)
      const rendered: Record<string, string> = {}
      for (const p of spec?.params ?? [])
        if (p.vars && typeof node.params[p.key] === 'string')
          rendered[p.label] = render(node.params[p.key] as string, scope)
      let port: string | null = mainPort(node)
      let note: string | null = null
      if (spec?.subjects !== 'any' && def.subject !== 'none' && !scope[def.subject])
        note = 'Se omitiría: el sujeto no existe.'
      if (node.type === 'if_else') {
        port = pickBranch(branchesOf(node.params), scope)
        note =
          port === 'none'
            ? 'Ninguna rama se cumple.'
            : `Rama «${branchesOf(node.params).find((b) => b.id === port)?.name}».`
      } else if (node.type === 'wait') {
        if (str(node.params, 'mode') === 'condition') {
          const met = evaluate((node.params.conditions as ConditionGroup[]) ?? [], scope)
          port = MET_PORT
          note = met ? 'La condición ya se cumple.' : 'Se da por cumplida en la prueba.'
        } else note = 'La espera se da por cumplida en la prueba.'
      } else if (node.type === 'go_to') {
        const target = str(node.params, 'target')
        note = upstream(def, node.id).includes(target)
          ? 'Volvería a un paso anterior; la prueba se detiene aquí.'
          : 'El destino no es válido.'
        port = null
      } else if (node.type === 'finish') port = null
      steps.push({
        nodeId: node.id,
        type: node.type,
        name: node.name,
        sentence: describeNode(node, names),
        rendered,
        port,
        note
      })
      current = port ? (node.next[port] ?? null) : null
    }
    return { subjectLabel: label, matchedTrigger, steps }
  }

  async runManual(id: string, subjectId: string | null): Promise<void> {
    await transactionGuard(this.db, async (manager) => {
      const row = await this.find(manager, id)
      if (row.status !== 'active')
        throw new AppError('invalid', 'Activa la automatización para ejecutarla.')
      const subject = row.draft.subject
      if (subject !== 'none' && !subjectId)
        throw new AppError('invalid', 'Elige sobre qué ejecutarla.')
      await emit(
        manager,
        'manual',
        { type: subject, id: subject === 'none' ? null : subjectId },
        { automationId: row.id, origin: this.origin() }
      )
    })
    this.deps.kick()
  }

  async references(kind: RefTarget, value: string): Promise<{ id: string; name: string }[]> {
    const rows = await this.db.getRepository(AutomationModel).find()
    return rows
      .filter((r) => usesRef(r.draft, kind, value))
      .map((r) => ({ id: r.id, name: r.name }))
  }

  async options(): Promise<AutomationOptions> {
    const m = this.db.manager
    const byName = <T extends { name: string }>(rows: T[]): T[] =>
      [...rows].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    const tags = await m.getRepository(TagModel).find()
    const pipelines = await m.getRepository(PipelineModel).find()
    const stages = await m.getRepository(StageModel).find({ order: { position: 'ASC' } })
    const clients = await m.getRepository(ClientModel).find()
    const projects = await m.getRepository(ProjectModel).find()
    return {
      tags: byName(tags.map((t) => ({ id: t.slug, name: t.name }))),
      pipelines: byName(pipelines.map((p) => ({ id: p.id, name: p.name }))),
      stages: stages.map((s) => ({ id: s.id, name: s.name, pipelineId: s.pipelineId })),
      clients: byName(clients.map((c) => ({ id: c.id, name: c.name }))),
      projects: byName(projects.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId })))
    }
  }

  async subjects(type: SubjectType, query: string): Promise<SubjectOption[]> {
    const q = normalizeName(typeof query === 'string' ? query : '')
    const m = this.db.manager
    const rows: SubjectOption[] =
      type === 'contact'
        ? (
            await m.getRepository(ContactModel).find({ order: { updatedAt: 'DESC' }, take: 2000 })
          ).map((c) => ({
            id: c.id,
            label: contactLabel(c),
            hint: c.email
          }))
        : type === 'prospect'
          ? (await m.getRepository(ProspectModel).find({ order: { updatedAt: 'DESC' } })).map(
              (p) => ({
                id: p.id,
                label: p.company,
                hint: null
              })
            )
          : type === 'client'
            ? (await m.getRepository(ClientModel).find()).map((c) => ({
                id: c.id,
                label: c.name,
                hint: null
              }))
            : type === 'task'
              ? (
                  await m.getRepository(TaskModel).find({ order: { date: 'DESC' }, take: 2000 })
                ).map((t) => ({
                  id: t.id,
                  label: t.title,
                  hint: t.date
                }))
              : type === 'meeting'
                ? (
                    await m
                      .getRepository(MeetingModel)
                      .find({ order: { createdAt: 'DESC' }, take: 2000 })
                  ).map((x) => ({ id: x.id, label: x.title, hint: null }))
                : []
    return rows
      .filter((r) => !q || normalizeName(`${r.label} ${r.hint ?? ''}`).includes(q))
      .slice(0, 20)
  }
}
