import { ACTIVE_NODES, TRIGGERS, type ParamSpec } from './catalog'
import { FIELDS, OPERATORS_BY_KIND, subjectVariables, VALUELESS } from './fields'
import { SUBJECT_LABELS, SUBJECT_TYPES } from './model'

const param = (p: ParamSpec): Record<string, unknown> => ({
  key: p.key,
  label: p.label,
  kind: p.kind,
  ...(p.required ? { required: true } : {}),
  ...(p.vars ? { variables: true } : {}),
  ...(p.options ? { options: p.options.map((o) => o.value) } : {}),
  ...(p.when ? { onlyWhen: p.when } : {})
})

export function catalogSummary(): Record<string, unknown> {
  return {
    definition: {
      shape:
        '{ subject, settings: { reentry: "allow"|"never", window: null|{ days: number[], start: "HH:MM", end: "HH:MM" } }, triggers: TriggerDef[], root: nodeId|null, nodes: Record<id, NodeDef> }',
      trigger: '{ id, type, params, conditions: ConditionGroup[] }',
      node: '{ id, type, name, params, next: Record<port, nodeId|null> }',
      conditions:
        'ConditionGroup = { join: "and"|"or", conditions: { field, operator, value }[] }. Los grupos se combinan con Y.',
      ports:
        'Paso normal: "next". if_else: el id de cada rama y "none". wait con mode condition: "met" y "timeout". go_to y finish no tienen salida.',
      templates:
        'Usa {{variable}} en los campos con variables: true. Salidas de pasos anteriores: {{steps.<id>.<clave>}}.'
    },
    subjects: SUBJECT_TYPES.map((s) => ({
      type: s,
      label: SUBJECT_LABELS[s],
      variables: subjectVariables(s).map((v) => v.key)
    })),
    triggers: TRIGGERS.map((t) => ({
      type: t.type,
      label: t.label,
      description: t.description,
      subject: t.subject,
      params: t.params.map(param)
    })),
    nodes: ACTIVE_NODES.map((n) => ({
      type: n.type,
      label: n.label,
      description: n.description,
      subjects: n.subjects,
      destructive: n.destructive || undefined,
      params: n.params.map(param),
      outputs: n.outputs.map((o) => o.key)
    })),
    fields: Object.fromEntries(
      SUBJECT_TYPES.map((s) => [s, FIELDS[s].map((f) => ({ key: f.key, kind: f.kind }))])
    ),
    customFields: 'contact.fields.<clave> para campos personalizados del contacto (texto).',
    operators: OPERATORS_BY_KIND,
    valueless: VALUELESS
  }
}
