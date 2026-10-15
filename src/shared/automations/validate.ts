import {
  branchesOf,
  nodeAllowed,
  nodeIssues,
  nodeSpec,
  str,
  strings,
  triggerAllowed,
  triggerIssues,
  triggerSpec,
  visible,
  type ParamSpec,
  type RefKind
} from './catalog'
import { fieldSpec, OPERATORS_BY_KIND, VALUELESS } from './fields'
import { portsOf, reachable, upstream } from './graph'
import {
  SUBJECT_TYPES,
  type ConditionGroup,
  type Definition,
  type Issue,
  type Params,
  type SubjectType
} from './model'

export type RefTarget = Exclude<RefKind, 'node'>

export type Refs = Partial<Record<RefTarget, Set<string>>>

const REF_KINDS: Record<string, Exclude<RefKind, 'node'>> = {
  tag: 'tag',
  tags: 'tag',
  pipeline: 'pipeline',
  stage: 'stage',
  client: 'client',
  project: 'project'
}

const REF_LABEL: Record<Exclude<RefKind, 'node'>, string> = {
  tag: 'El tag',
  pipeline: 'El pipeline',
  stage: 'La etapa',
  client: 'El cliente',
  project: 'El proyecto'
}

function refIssues(specs: ParamSpec[], params: Params, refs: Refs): string[] {
  const out: string[] = []
  for (const spec of specs) {
    const kind = REF_KINDS[spec.kind]
    if (!kind || !visible(spec, params)) continue
    const known = refs[kind]
    if (!known) continue
    const values =
      spec.kind === 'tags' ? strings(params, spec.key) : [str(params, spec.key)].filter(Boolean)
    for (const value of values) if (!known.has(value)) out.push(`${REF_LABEL[kind]} ya no existe.`)
  }
  return out
}

export function conditionIssues(groups: ConditionGroup[], subject: SubjectType): string[] {
  const out: string[] = []
  for (const group of groups) {
    for (const condition of group.conditions) {
      const field = fieldSpec(subject, condition.field)
      if (!field) {
        out.push('Una condición usa un campo que no existe.')
        continue
      }
      if (!OPERATORS_BY_KIND[field.kind].includes(condition.operator)) {
        out.push(`El operador no sirve para ${field.label.toLowerCase()}.`)
        continue
      }
      const value = condition.value
      const empty =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      if (!VALUELESS.includes(condition.operator) && empty)
        out.push(`Falta el valor de ${field.label.toLowerCase()}.`)
    }
  }
  return out
}

function groupsOf(value: unknown): ConditionGroup[] {
  return Array.isArray(value) ? (value as ConditionGroup[]) : []
}

export function validateDefinition(def: Definition, refs: Refs = {}): Issue[] {
  const issues: Issue[] = []
  const push = (path: string, message: string, extra: Partial<Issue> = {}): void => {
    issues.push({ path, message, ...extra })
  }

  if (!SUBJECT_TYPES.includes(def.subject)) push('subject', 'El tipo de sujeto no existe.')
  if (def.triggers.length === 0) push('triggers', 'Añade al menos un trigger.')

  const triggerIds = new Set<string>()
  def.triggers.forEach((trigger, i) => {
    const path = `triggers.${i}`
    const extra = { triggerId: trigger.id }
    if (triggerIds.has(trigger.id)) push(path, 'Hay triggers repetidos.', extra)
    triggerIds.add(trigger.id)
    const spec = triggerSpec(trigger.type)
    if (!spec) return push(path, 'Ese trigger no existe.', extra)
    if (!triggerAllowed(spec, def.subject))
      push(path, 'Este trigger es para otro tipo de sujeto.', extra)
    for (const m of triggerIssues(spec, trigger.params)) push(path, m, extra)
    for (const m of refIssues(spec.params, trigger.params, refs)) push(path, m, extra)
    for (const m of conditionIssues(trigger.conditions ?? [], def.subject))
      push(`${path}.conditions`, m, extra)
  })

  const ids = Object.keys(def.nodes)
  if (ids.length > 0 && !def.root) push('root', 'Falta el primer paso.')
  if (def.root && !def.nodes[def.root]) push('root', 'El primer paso no existe.')

  const parents = new Map<string, number>()
  for (const node of Object.values(def.nodes)) {
    for (const child of Object.values(node.next)) {
      if (!child) continue
      parents.set(child, (parents.get(child) ?? 0) + 1)
      if (!def.nodes[child])
        push(`nodes.${node.id}`, 'Apunta a un paso que no existe.', { nodeId: node.id })
    }
  }
  if (def.root && parents.has(def.root)) push('root', 'El camino vuelve al primer paso.')

  const live = reachable(def)
  for (const id of ids) {
    const node = def.nodes[id]
    const path = `nodes.${id}`
    const extra = { nodeId: id }
    if (!live.has(id)) {
      push(path, 'Este paso no está conectado.', extra)
      continue
    }
    if ((parents.get(id) ?? 0) > 1)
      push(path, 'Este paso tiene más de un camino de entrada.', extra)
    const spec = nodeSpec(node.type)
    if (!spec) {
      push(path, 'Ese tipo de paso no existe.', extra)
      continue
    }
    if (!nodeAllowed(spec, def.subject))
      push(path, 'Este paso no aplica a este tipo de sujeto.', extra)
    for (const m of nodeIssues(spec, node.params)) push(path, m, extra)
    for (const m of refIssues(spec.params, node.params, refs)) push(path, m, extra)
    const ports = portsOf(node)
    const keys = Object.keys(node.next)
    if (keys.length !== ports.length || ports.some((p) => !(p in node.next)))
      push(path, 'Las salidas del paso no coinciden con su configuración.', extra)
    if (node.type === 'if_else')
      branchesOf(node.params).forEach((b) => {
        for (const m of conditionIssues(b.groups ?? [], def.subject)) push(path, m, extra)
      })
    if (node.type === 'wait' && str(node.params, 'mode') === 'condition')
      for (const m of conditionIssues(groupsOf(node.params.conditions), def.subject))
        push(path, m, extra)
    if (node.type === 'go_to') {
      const target = str(node.params, 'target')
      if (target && !upstream(def, id).includes(target))
        push(path, '«Ir a» solo puede volver a un paso anterior del mismo camino.', extra)
    }
  }
  return issues
}

export function issuesByNode(issues: Issue[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = issue.nodeId ?? issue.triggerId
    if (key) (out[key] ??= []).push(issue.message)
  }
  return out
}

export function isDestructive(def: Definition): boolean {
  return [...reachable(def)].some((id) => nodeSpec(def.nodes[id].type)?.destructive)
}

export function usesRef(def: Definition, kind: RefTarget, value: string): boolean {
  const hit = (specs: ParamSpec[], params: Params): boolean =>
    specs.some(
      (spec) =>
        REF_KINDS[spec.kind] === kind &&
        (spec.kind === 'tags' ? strings(params, spec.key) : [str(params, spec.key)]).includes(value)
    )
  return (
    def.triggers.some((t) => hit(triggerSpec(t.type)?.params ?? [], t.params)) ||
    Object.values(def.nodes).some((n) => hit(nodeSpec(n.type)?.params ?? [], n.params))
  )
}
