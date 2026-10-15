import { nodeSpec, triggerSpec, type Names } from './catalog'
import { mainPort } from './graph'
import type { Definition, NodeDef, TriggerDef } from './model'

const ID: Names = () => undefined

export function describeTrigger(trigger: TriggerDef, names: Names = ID): string {
  return triggerSpec(trigger.type)?.sentence(trigger.params, names) ?? trigger.type
}

export function describeNode(node: NodeDef, names: Names = ID): string {
  return nodeSpec(node.type)?.sentence(node.params, names) ?? node.type
}

export function describeDefinition(def: Definition, names: Names = ID, limit = 4): string {
  const when = def.triggers.map((t) => describeTrigger(t, names))
  const head = when.length ? `Cuando ${when.join(' o ').toLowerCase()}` : 'Sin trigger'
  const steps: string[] = []
  const seen = new Set<string>()
  let current = def.root
  while (current && !seen.has(current) && steps.length < limit) {
    seen.add(current)
    const node = def.nodes[current]
    if (!node) break
    steps.push(describeNode(node, names).toLowerCase())
    if (node.type === 'if_else') break
    const port = mainPort(node)
    current = port ? node.next[port] : null
  }
  const total = Object.keys(def.nodes).length
  const tail = total > steps.length ? ' …' : ''
  return steps.length ? `${head} → ${steps.join(' → ')}${tail}` : head
}
