import {
  branchesOf,
  durationMs,
  evaluate,
  lookup,
  MET_PORT,
  num,
  pickBranch,
  str,
  TIMEOUT_PORT,
  type ConditionGroup,
  type TimeUnit
} from '@shared/automations'
import type { Handlers, NodeContext, NodeResult } from '../ports'

export const GOTO_PORT = '$goto'
export const END_PORT = '$end'

const unit = (value: string): TimeUnit =>
  value === 'minutes' || value === 'hours' ? value : 'days'

const groups = (value: unknown): ConditionGroup[] =>
  Array.isArray(value) ? (value as ConditionGroup[]) : []

function until(ctx: NodeContext, target: number): NodeResult {
  const now = ctx.ports.clock.now().getTime()
  if (ctx.resumed || target <= now) return { kind: 'next' }
  return { kind: 'wait', until: new Date(target).toISOString() }
}

function waitNode(ctx: NodeContext): NodeResult {
  const p = ctx.node.params
  const mode = str(p, 'mode')
  const now = ctx.ports.clock.now().getTime()
  if (mode === 'delay') {
    if (ctx.resumed) return { kind: 'next' }
    return until(ctx, now + durationMs(num(p, 'amount') ?? 0, unit(str(p, 'unit'))))
  }
  if (mode === 'until') {
    if (str(p, 'from') === 'fixed') {
      const at = Date.parse(str(p, 'at'))
      return Number.isNaN(at)
        ? { kind: 'skip', reason: 'La fecha de la espera no es válida.' }
        : until(ctx, at)
    }
    const raw = lookup(ctx.scope, str(p, 'field'))
    const base = typeof raw === 'string' || typeof raw === 'number' ? Date.parse(String(raw)) : NaN
    if (Number.isNaN(base)) return { kind: 'skip', reason: 'El campo de fecha está vacío.' }
    const offset = durationMs(num(p, 'offset') ?? 0, unit(str(p, 'offsetUnit')))
    return until(ctx, str(p, 'direction') === 'before' ? base - offset : base + offset)
  }
  const conditions = groups(p.conditions)
  if (evaluate(conditions, ctx.scope)) return { kind: 'next', port: MET_PORT }
  const deadline = ctx.run.wait?.until ? Date.parse(ctx.run.wait.until) : NaN
  if (ctx.resumed && !Number.isNaN(deadline)) {
    if (now >= deadline) return { kind: 'next', port: TIMEOUT_PORT }
    return { kind: 'wait', until: ctx.run.wait!.until, conditions }
  }
  const timeout = durationMs(num(p, 'timeout') ?? 1, unit(str(p, 'timeoutUnit')))
  return { kind: 'wait', until: new Date(now + timeout).toISOString(), conditions }
}

export const CONTROL_HANDLERS: Handlers = {
  if_else: {
    run: async (ctx) => ({ kind: 'next', port: pickBranch(branchesOf(ctx.node.params), ctx.scope) })
  },
  wait: { run: async (ctx) => waitNode(ctx) },
  go_to: { run: async () => ({ kind: 'next', port: GOTO_PORT }) },
  finish: { run: async () => ({ kind: 'next', port: END_PORT }) }
}
