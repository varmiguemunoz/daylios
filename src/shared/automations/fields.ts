import type { Operator, SubjectType } from './model'

export type FieldKind = 'text' | 'number' | 'date' | 'list' | 'boolean' | 'select'

export interface FieldSpec {
  key: string
  label: string
  kind: FieldKind
  options?: { value: string; label: string }[]
  source?: 'tag' | 'pipeline' | 'stage' | 'client' | 'status'
}

export const OPERATORS_BY_KIND: Record<FieldKind, Operator[]> = {
  text: ['is', 'is_not', 'contains', 'not_contains', 'starts_with', 'is_empty', 'is_not_empty'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_empty', 'is_not_empty'],
  date: [
    'before',
    'after',
    'between',
    'within_days',
    'older_than_days',
    'is_empty',
    'is_not_empty'
  ],
  list: ['includes', 'excludes', 'is_empty', 'is_not_empty'],
  boolean: ['is'],
  select: ['is', 'is_not', 'is_empty', 'is_not_empty']
}

export const OPERATOR_LABELS: Record<Operator, string> = {
  is: 'es',
  is_not: 'no es',
  contains: 'contiene',
  not_contains: 'no contiene',
  starts_with: 'empieza por',
  is_empty: 'está vacío',
  is_not_empty: 'tiene valor',
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: 'entre',
  before: 'antes de',
  after: 'después de',
  within_days: 'en los últimos N días',
  older_than_days: 'hace más de N días',
  includes: 'incluye',
  excludes: 'no incluye'
}

export const VALUELESS: Operator[] = ['is_empty', 'is_not_empty']

const CONTACT: FieldSpec[] = [
  { key: 'contact.name', label: 'Nombre', kind: 'text' },
  { key: 'contact.email', label: 'Email', kind: 'text' },
  { key: 'contact.phone', label: 'Teléfono', kind: 'text' },
  { key: 'contact.role', label: 'Rol', kind: 'text' },
  { key: 'contact.source', label: 'Fuente', kind: 'text' },
  { key: 'contact.tags', label: 'Tags', kind: 'list', source: 'tag' },
  { key: 'contact.status', label: 'Estado de marketing', kind: 'select', source: 'status' },
  { key: 'contact.hasClient', label: 'Tiene cliente', kind: 'boolean' },
  { key: 'contact.createdAt', label: 'Fecha de alta', kind: 'date' }
]

const PROSPECT: FieldSpec[] = [
  { key: 'prospect.company', label: 'Empresa del prospecto', kind: 'text' },
  { key: 'prospect.value', label: 'Valor del prospecto', kind: 'number' },
  { key: 'prospect.pipelineId', label: 'Pipeline', kind: 'select', source: 'pipeline' },
  { key: 'prospect.stageId', label: 'Etapa', kind: 'select', source: 'stage' },
  { key: 'prospect.open', label: 'Prospecto abierto', kind: 'boolean' },
  { key: 'prospect.nextStepDate', label: 'Fecha del próximo paso', kind: 'date' }
]

const CLIENT: FieldSpec[] = [
  { key: 'client.name', label: 'Cliente', kind: 'text' },
  { key: 'client.status', label: 'Estado del cliente', kind: 'text' }
]

const TASK: FieldSpec[] = [
  { key: 'task.title', label: 'Título de la tarea', kind: 'text' },
  { key: 'task.tags', label: 'Tags de la tarea', kind: 'list' }
]

const MEETING: FieldSpec[] = [
  { key: 'meeting.title', label: 'Título de la reunión', kind: 'text' },
  { key: 'meeting.date', label: 'Fecha de la reunión', kind: 'date' }
]

const COMMON: FieldSpec[] = [{ key: 'now', label: 'Ahora', kind: 'date' }]

export const FIELDS: Record<SubjectType, FieldSpec[]> = {
  contact: [...CONTACT, ...PROSPECT, ...CLIENT, ...COMMON],
  prospect: [...PROSPECT, ...CONTACT, ...CLIENT, ...COMMON],
  client: [...CLIENT, ...COMMON],
  task: [...TASK, ...CLIENT, ...COMMON],
  meeting: [...MEETING, ...CLIENT, ...COMMON],
  none: COMMON
}

export const CUSTOM_FIELD_PREFIX = 'contact.fields.'

export function fieldSpec(subject: SubjectType, key: string): FieldSpec | null {
  const found = FIELDS[subject].find((f) => f.key === key)
  if (found) return found
  if (
    key.startsWith(CUSTOM_FIELD_PREFIX) &&
    FIELDS[subject].some((f) => f.key.startsWith('contact.'))
  )
    return { key, label: key.slice(CUSTOM_FIELD_PREFIX.length), kind: 'text' }
  return null
}

export interface VariableSpec {
  key: string
  label: string
}

const SUBJECT_VARIABLES: Record<SubjectType, VariableSpec[]> = {
  contact: [
    { key: 'contact.name', label: 'Nombre' },
    { key: 'contact.first_name', label: 'Primer nombre' },
    { key: 'contact.email', label: 'Email' },
    { key: 'contact.company', label: 'Empresa' },
    { key: 'contact.role', label: 'Rol' },
    { key: 'prospect.company', label: 'Empresa del prospecto' },
    { key: 'prospect.stage', label: 'Etapa' },
    { key: 'prospect.value', label: 'Valor' },
    { key: 'client.name', label: 'Cliente' }
  ],
  prospect: [
    { key: 'prospect.company', label: 'Empresa' },
    { key: 'prospect.stage', label: 'Etapa' },
    { key: 'prospect.value', label: 'Valor' },
    { key: 'contact.name', label: 'Contacto' },
    { key: 'contact.email', label: 'Email del contacto' },
    { key: 'client.name', label: 'Cliente' }
  ],
  client: [{ key: 'client.name', label: 'Cliente' }],
  task: [
    { key: 'task.title', label: 'Tarea' },
    { key: 'client.name', label: 'Cliente' }
  ],
  meeting: [
    { key: 'meeting.title', label: 'Reunión' },
    { key: 'client.name', label: 'Cliente' }
  ],
  none: []
}

export function subjectVariables(subject: SubjectType): VariableSpec[] {
  return [...SUBJECT_VARIABLES[subject], { key: 'today', label: 'Hoy' }]
}
