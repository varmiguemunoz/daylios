import { randomUUID } from 'crypto'
import type { DataSource, EntityManager } from 'typeorm'
import {
  mainPort,
  nextWindowOpen,
  nodeAllowed,
  nodeSpec,
  render,
  RETRY_MINUTES,
  str,
  upstream,
  type AutomationRun,
  type Cause,
  type Definition,
  type NodeDef,
  type RunStatus,
  type StepStatus
} from '@shared/automations'
import { transactionGuard } from '../guards/transaction.guard'
import { AutomationRunModel, RunStepModel } from '../models/automation.model'
import { withCause } from './events'
import { END_PORT, GOTO_PORT } from './handlers/control'
import {
  ExternalError,
  NotConfigured,
  type Handlers,
  type NodeContext,
  type NodeResult,
  type Ports
} from './ports'
import { loadScope, subjectExists } from './scope'

const MAX_NODES_PER_PASS = 100

export interface RunnerDeps {
  db: DataSource
  handlers: Handlers
  ports: Ports
  definition(versionId: string): Promise<Definition | null>
  onFailed?(run: AutomationRun): void
}

const OPEN: RunStatus[] = ['active', 'waiting']

export class Runner {
  constructor(private readonly deps: RunnerDeps) {}

  private now(): Date {
    return this.deps.ports.clock.now()
  }

  async advance(runId: string): Promise<AutomationRun | null> {
    const first = await this.load(runId)
    if (!first || !OPEN.includes(first.status)) return first
    let run: AutomationRun = first
    const def = await this.deps.definition(run.versionId)
    if (!def) return this.close(run, 'failed', 'La versión de esta automatización ya no existe.')

    for (let i = 0; i < MAX_NODES_PER_PASS; i++) {
      if (!run.nodeId) return this.close(run, 'finished', null)
      const node = def.nodes[run.nodeId]
      if (!node) return this.close(run, 'failed', 'El paso ya no existe en esta versión.')
      const spec = nodeSpec(node.type)
      const handler = this.deps.handlers[node.type]
      if (!spec || !handler)
        return this.close(run, 'failed', `No se sabe ejecutar el paso «${node.type}».`)

      if (spec.communication) {
        const open = nextWindowOpen(def.settings.window, this.now())
        if (open) {
          run = await this.save(run, {
            status: 'waiting',
            wait: { kind: 'window', until: open.toISOString() },
            nextAt: open.toISOString()
          })
          return run
        }
      }

      const resumed =
        run.status === 'waiting' && (run.wait?.kind === 'time' || run.wait?.kind === 'condition')
      const result =
        spec.external || handler.outside
          ? await this.external(run, def, node, resumed)
          : await this.internal(run, def, node, resumed)
      if (!result) return this.load(runId)
      run = result
      if (!OPEN.includes(run.status) || run.status === 'waiting') return run
    }
    return this.save(run, { nextAt: this.now().toISOString() })
  }

  private cause(run: AutomationRun): Cause {
    return {
      runId: run.id,
      automationId: run.automationId,
      depth: run.depth + 1,
      chain: [...run.chain, run.automationId]
    }
  }

  private context(
    manager: EntityManager | null,
    run: AutomationRun,
    node: NodeDef,
    scope: Record<string, unknown>,
    resumed: boolean
  ): NodeContext {
    return {
      manager,
      run,
      node,
      scope,
      ports: this.deps.ports,
      dryRun: false,
      resumed,
      idempotencyKey: `${run.id}:${node.id}`,
      render: (text, options) => render(text, scope, options)
    }
  }

  private async internal(
    run: AutomationRun,
    def: Definition,
    node: NodeDef,
    resumed: boolean
  ): Promise<AutomationRun | null> {
    try {
      return await transactionGuard(this.deps.db, (manager) =>
        withCause(this.cause(run), async () => {
          const fresh = await manager.getRepository(AutomationRunModel).findOneBy({ id: run.id })
          if (!fresh || !OPEN.includes(fresh.status)) return null
          const scope = await loadScope(manager, fresh, this.now())
          const result = await this.execute(manager, fresh, def, node, scope, resumed)
          return this.apply(manager, fresh, def, node, result, resumed)
        })
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return transactionGuard(this.deps.db, (manager) =>
        this.apply(
          manager,
          run,
          def,
          node,
          { kind: 'fail', reason: message, retryable: false },
          resumed
        )
      )
    }
  }

  private async external(
    run: AutomationRun,
    def: Definition,
    node: NodeDef,
    resumed: boolean
  ): Promise<AutomationRun | null> {
    const scope = await loadScope(this.deps.db.manager, run, this.now())
    let result: NodeResult
    try {
      result = await this.execute(null, run, def, node, scope, resumed)
    } catch (err) {
      if (err instanceof NotConfigured) result = { kind: 'skip', reason: err.message }
      else if (err instanceof ExternalError)
        result = { kind: 'fail', reason: err.message, retryable: err.retryable }
      else
        result = {
          kind: 'fail',
          reason: err instanceof Error ? err.message : String(err),
          retryable: true
        }
    }
    return transactionGuard(this.deps.db, async (manager) => {
      const fresh = await manager.getRepository(AutomationRunModel).findOneBy({ id: run.id })
      if (!fresh || !OPEN.includes(fresh.status)) return null
      return this.apply(manager, fresh, def, node, result, resumed)
    })
  }

  private async execute(
    manager: EntityManager | null,
    run: AutomationRun,
    def: Definition,
    node: NodeDef,
    scope: Record<string, unknown>,
    resumed: boolean
  ): Promise<NodeResult> {
    const spec = nodeSpec(node.type)!
    if (spec.subjects !== 'any' && !nodeAllowed(spec, def.subject))
      return { kind: 'skip', reason: 'Este paso no aplica a este tipo de sujeto.' }
    if (spec.subjects !== 'any' && !subjectExists(scope, def.subject))
      return { kind: 'skip', reason: 'El sujeto ya no existe.' }
    return this.deps.handlers[node.type]!.run(this.context(manager, run, node, scope, resumed))
  }

  private nextNode(def: Definition, node: NodeDef, port: string | undefined): string | null {
    if (port === END_PORT) return null
    if (port === GOTO_PORT) {
      const target = str(node.params, 'target')
      return target && upstream(def, node.id).includes(target) ? target : null
    }
    const key = port ?? mainPort(node)
    return key ? (node.next[key] ?? null) : null
  }

  private async apply(
    manager: EntityManager,
    run: AutomationRun,
    def: Definition,
    node: NodeDef,
    result: NodeResult,
    resumed: boolean
  ): Promise<AutomationRun> {
    const now = this.now().toISOString()
    const runs = manager.getRepository(AutomationRunModel)
    const attempt = run.attempts + 1

    if (result.kind === 'wait') {
      if (!resumed)
        await this.step(
          manager,
          run,
          node,
          'waiting',
          attempt,
          this.waitMessage(result.until),
          null
        )
      const updated: AutomationRun = {
        ...run,
        status: 'waiting',
        wait: {
          kind: result.conditions ? 'condition' : 'time',
          until: result.until,
          conditions: result.conditions
        },
        nextAt: result.until,
        updatedAt: now
      }
      return runs.save(updated)
    }

    if (result.kind === 'fail') {
      const spec = nodeSpec(node.type)
      if (result.retryable && spec?.external && run.attempts < RETRY_MINUTES.length) {
        const until = new Date(
          this.now().getTime() + RETRY_MINUTES[run.attempts] * 60_000
        ).toISOString()
        await this.step(manager, run, node, 'retrying', attempt, result.reason, null)
        return runs.save({
          ...run,
          status: 'waiting',
          attempts: attempt,
          wait: { kind: 'retry', until },
          nextAt: until,
          reason: result.reason,
          updatedAt: now
        })
      }
      const reason =
        spec?.external && run.attempts > 0
          ? `Límite de reintentos: ${result.reason}`
          : result.reason
      await this.step(manager, run, node, 'failed', attempt, reason, null)
      const failed = await runs.save({
        ...run,
        status: 'failed',
        reason,
        nextAt: null,
        wait: null,
        finishedAt: now,
        updatedAt: now
      })
      this.deps.onFailed?.(failed)
      return failed
    }

    const output = result.kind === 'next' ? (result.output ?? null) : null
    const status: StepStatus = result.kind === 'skip' ? 'skipped' : 'ok'
    const message = result.kind === 'skip' ? result.reason : null
    if (resumed && status === 'ok') await this.closeWaiting(manager, run, node, output)
    else await this.step(manager, run, node, status, attempt, message, output)

    const outputs = output ? { ...run.outputs, [node.id]: output } : run.outputs
    const next = this.nextNode(def, node, result.port)
    return runs.save({
      ...run,
      status: next ? 'active' : 'finished',
      nodeId: next,
      nextAt: next ? now : null,
      wait: null,
      attempts: 0,
      outputs,
      reason: null,
      finishedAt: next ? null : now,
      updatedAt: now
    })
  }

  private waitMessage(until: string | null): string {
    return until ? `Esperando hasta ${until}` : 'Esperando'
  }

  private async step(
    manager: EntityManager,
    run: AutomationRun,
    node: NodeDef,
    status: StepStatus,
    attempt: number,
    message: string | null,
    output: Record<string, unknown> | null
  ): Promise<void> {
    const now = this.now().toISOString()
    await manager.getRepository(RunStepModel).save({
      id: randomUUID(),
      runId: run.id,
      automationId: run.automationId,
      nodeId: node.id,
      nodeType: node.type,
      status,
      attempt,
      message,
      output,
      startedAt: now,
      endedAt: status === 'waiting' || status === 'retrying' ? null : now
    })
  }

  private async closeWaiting(
    manager: EntityManager,
    run: AutomationRun,
    node: NodeDef,
    output: Record<string, unknown> | null
  ): Promise<void> {
    const steps = manager.getRepository(RunStepModel)
    const open = await steps.findOne({
      where: { runId: run.id, nodeId: node.id, status: 'waiting' },
      order: { startedAt: 'DESC' }
    })
    const now = this.now().toISOString()
    if (open) await steps.save({ ...open, status: 'ok', endedAt: now, output })
    else await this.step(manager, run, node, 'ok', run.attempts + 1, null, output)
  }

  private load(id: string): Promise<AutomationRun | null> {
    return this.deps.db.getRepository(AutomationRunModel).findOneBy({ id })
  }

  private save(run: AutomationRun, patch: Partial<AutomationRun>): Promise<AutomationRun> {
    return transactionGuard(this.deps.db, (manager) =>
      manager
        .getRepository(AutomationRunModel)
        .save({ ...run, ...patch, updatedAt: this.now().toISOString() })
    )
  }

  private async close(
    run: AutomationRun,
    status: RunStatus,
    reason: string | null
  ): Promise<AutomationRun> {
    const now = this.now().toISOString()
    const closed = await this.save(run, {
      status,
      reason,
      nextAt: null,
      wait: null,
      finishedAt: now
    })
    if (status === 'failed') this.deps.onFailed?.(closed)
    return closed
  }
}
