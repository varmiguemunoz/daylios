import { nodeSpec, triggerSpec, type ParamSpec } from './catalog'
import type { Branch, NodeDef, NodeType, Params, TriggerDef, TriggerType } from './model'

const uuid = (): string => globalThis.crypto.randomUUID()

function defaults(specs: ParamSpec[]): Params {
  const params: Params = {}
  for (const spec of specs) {
    if (spec.kind === 'select' && spec.required && spec.options?.length)
      params[spec.key] = spec.options[0].value
    if (spec.kind === 'boolean') params[spec.key] = false
  }
  return params
}

export function newBranch(index: number, id: string = uuid()): Branch {
  return { id, name: `Rama ${index + 1}`, groups: [{ join: 'and', conditions: [] }] }
}

export function newNode(type: NodeType, id: string = uuid()): NodeDef {
  const spec = nodeSpec(type)
  const params = defaults(spec?.params ?? [])
  if (type === 'if_else') params.branches = [newBranch(0)]
  if (type === 'wait') Object.assign(params, { amount: 1, unit: 'days' })
  return { id, type, name: spec?.label ?? type, params, next: {} }
}

export function newTrigger(type: TriggerType, id: string = uuid()): TriggerDef {
  return { id, type, params: defaults(triggerSpec(type)?.params ?? []), conditions: [] }
}
