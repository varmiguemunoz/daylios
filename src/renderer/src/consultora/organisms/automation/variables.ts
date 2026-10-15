import {
  nodeSpec,
  stepVariable,
  subjectVariables,
  upstream,
  type Definition
} from '@shared/automations'
import type { Variable } from '../../molecules/automation/VariableMenu'

export function variablesFor(def: Definition, nodeId: string | null): Variable[] {
  const base = subjectVariables(def.subject).map((v) => ({ key: v.key, label: v.label }))
  if (!nodeId) return base
  const steps = upstream(def, nodeId).flatMap((id) => {
    const node = def.nodes[id]
    const spec = node ? nodeSpec(node.type) : undefined
    return (spec?.outputs ?? []).map((o) => ({
      key: stepVariable(id, o.key),
      label: `${node.name} · ${o.label}`
    }))
  })
  return [...base, ...steps]
}

export function upstreamNodes(def: Definition, nodeId: string): { id: string; name: string }[] {
  return upstream(def, nodeId).map((id) => ({ id, name: def.nodes[id]?.name || id }))
}
