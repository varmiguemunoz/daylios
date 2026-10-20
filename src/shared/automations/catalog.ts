import { NONE_PORT } from './conditions'
import type {
  AutomationEvent,
  Branch,
  NodeType,
  Params,
  SubjectType,
  TimeUnit,
  TriggerDef,
  TriggerType
} from './model'

export type ParamKind =
  | 'text'
  | 'markdown'
  | 'number'
  | 'select'
  | 'boolean'
  | 'tag'
  | 'tags'
  | 'pipeline'
  | 'stage'
  | 'client'
  | 'project'
  | 'field'
  | 'url'
  | 'datetime'
  | 'time'
  | 'conditions'
  | 'branches'
  | 'node'
  | 'effort'

export interface ParamSpec {
  key: string
  label: string
  kind: ParamKind
  required?: boolean
  vars?: boolean
  options?: { value: string; label: string }[]
  when?: { key: string; is: string[] }
  min?: number
}

export type RefKind = 'tag' | 'pipeline' | 'stage' | 'client' | 'project' | 'node'

export type Names = (kind: RefKind, id: string) => string | undefined

export type NodeGroup =
  'control' | 'contacto' | 'pipeline' | 'clientes' | 'email' | 'productividad' | 'integraciones'

export const NODE_GROUPS: { id: NodeGroup; label: string }[] = [
  { id: 'control', label: 'Control' },
  { id: 'contacto', label: 'Contacto' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'email', label: 'Email' },
  { id: 'productividad', label: 'Productividad' },
  { id: 'integraciones', label: 'Integraciones' }
]

export interface NodeSpec {
  type: NodeType
  kind: 'action' | 'control'
  group: NodeGroup
  label: string
  description: string
  icon: string
  subjects: SubjectType[] | 'any'
  external: boolean
  destructive: boolean
  communication: boolean
  terminal: boolean
  params: ParamSpec[]
  outputs: { key: string; label: string }[]
  retired?: string
  ports(params: Params): string[]
  validate?(params: Params): string[]
  sentence(params: Params, names: Names): string
}

export type TriggerGroup = 'contacto' | 'pipeline' | 'clientes' | 'productividad' | 'tiempo'

export interface TriggerSpec {
  type: TriggerType
  group: TriggerGroup
  label: string
  description: string
  icon: string
  subject: SubjectType | 'any'
  params: ParamSpec[]
  matches(trigger: TriggerDef, event: AutomationEvent, automationId: string): boolean
  sentence(params: Params, names: Names): string
}

export function str(params: Params, key: string): string {
  const value = params[key]
  return typeof value === 'string' ? value.trim() : ''
}

export function num(params: Params, key: string): number | null {
  const value = params[key]
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}

export function strings(params: Params, key: string): string[] {
  const value = params[key]
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function branchesOf(params: Params): Branch[] {
  const value = params.branches
  return Array.isArray(value) ? (value as Branch[]) : []
}

const UNIT_LABEL: Record<TimeUnit, [string, string]> = {
  minutes: ['minuto', 'minutos'],
  hours: ['hora', 'horas'],
  days: ['día', 'días']
}

export function unitText(amount: number, unit: TimeUnit): string {
  const [one, many] = UNIT_LABEL[unit] ?? UNIT_LABEL.days
  return `${amount} ${amount === 1 ? one : many}`
}

function unitOf(params: Params, key: string): TimeUnit {
  const u = str(params, key)
  return u === 'minutes' || u === 'hours' ? u : 'days'
}

const UNIT_OPTIONS = [
  { value: 'minutes', label: 'Minutos' },
  { value: 'hours', label: 'Horas' },
  { value: 'days', label: 'Días' }
]

const ref = (names: Names, kind: RefKind, id: string, fallback: string): string =>
  id ? (names(kind, id) ?? id) : fallback

const quote = (value: string): string => `«${value}»`

const next = (): string[] => ['next']
const none = (): string[] => []

const action = (
  spec: Omit<
    NodeSpec,
    'kind' | 'ports' | 'terminal' | 'outputs' | 'external' | 'destructive' | 'communication'
  > &
    Partial<Pick<NodeSpec, 'outputs' | 'external' | 'destructive' | 'communication' | 'retired'>>
): NodeSpec => ({
  kind: 'action',
  ports: next,
  terminal: false,
  outputs: [],
  external: false,
  destructive: false,
  communication: false,
  ...spec
})

const required = (params: Params, specs: ParamSpec[]): string[] =>
  specs
    .filter((p) => p.required && visible(p, params))
    .filter((p) => {
      const v = params[p.key]
      return (
        v === undefined ||
        v === null ||
        (typeof v === 'string' && v.trim() === '') ||
        (Array.isArray(v) && v.length === 0)
      )
    })
    .map((p) => `Falta ${p.label.toLowerCase()}.`)

export function visible(param: ParamSpec, params: Params): boolean {
  return !param.when || param.when.is.includes(str(params, param.when.key))
}

const WAIT_PARAMS: ParamSpec[] = [
  {
    key: 'mode',
    label: 'Tipo de espera',
    kind: 'select',
    required: true,
    options: [
      { value: 'delay', label: 'Durante un tiempo' },
      { value: 'until', label: 'Hasta una fecha y hora' },
      { value: 'condition', label: 'Hasta que se cumpla una condición' }
    ]
  },
  {
    key: 'amount',
    label: 'Cantidad',
    kind: 'number',
    min: 1,
    required: true,
    when: { key: 'mode', is: ['delay'] }
  },
  {
    key: 'unit',
    label: 'Unidad',
    kind: 'select',
    options: UNIT_OPTIONS,
    required: true,
    when: { key: 'mode', is: ['delay'] }
  },
  {
    key: 'from',
    label: 'Fecha',
    kind: 'select',
    required: true,
    when: { key: 'mode', is: ['until'] },
    options: [
      { value: 'fixed', label: 'Una fecha fija' },
      { value: 'field', label: 'Un campo del sujeto' }
    ]
  },
  {
    key: 'at',
    label: 'Fecha y hora',
    kind: 'datetime',
    required: true,
    when: { key: 'from', is: ['fixed'] }
  },
  {
    key: 'field',
    label: 'Campo de fecha',
    kind: 'field',
    required: true,
    when: { key: 'from', is: ['field'] }
  },
  { key: 'offset', label: 'Desplazamiento', kind: 'number', when: { key: 'from', is: ['field'] } },
  {
    key: 'offsetUnit',
    label: 'Unidad del desplazamiento',
    kind: 'select',
    options: UNIT_OPTIONS,
    when: { key: 'from', is: ['field'] }
  },
  {
    key: 'direction',
    label: 'Antes o después',
    kind: 'select',
    when: { key: 'from', is: ['field'] },
    options: [
      { value: 'before', label: 'Antes' },
      { value: 'after', label: 'Después' }
    ]
  },
  {
    key: 'conditions',
    label: 'Condición',
    kind: 'conditions',
    required: true,
    when: { key: 'mode', is: ['condition'] }
  },
  {
    key: 'timeout',
    label: 'Esperar como máximo',
    kind: 'number',
    min: 1,
    required: true,
    when: { key: 'mode', is: ['condition'] }
  },
  {
    key: 'timeoutUnit',
    label: 'Unidad del máximo',
    kind: 'select',
    options: UNIT_OPTIONS,
    required: true,
    when: { key: 'mode', is: ['condition'] }
  }
]

export const MET_PORT = 'met'
export const TIMEOUT_PORT = 'timeout'
export const NEXT_PORT = 'next'

export const PORT_LABELS: Record<string, string> = {
  [NEXT_PORT]: '',
  [MET_PORT]: 'Se cumplió',
  [TIMEOUT_PORT]: 'Tiempo agotado',
  [NONE_PORT]: 'Ninguna'
}

const CONTROL: NodeSpec[] = [
  {
    type: 'if_else',
    kind: 'control',
    group: 'control',
    label: 'Si / si no',
    description: 'Divide el camino en ramas según condiciones. Gana la primera rama que se cumple.',
    icon: 'Split',
    subjects: 'any',
    external: false,
    destructive: false,
    communication: false,
    terminal: false,
    params: [{ key: 'branches', label: 'Ramas', kind: 'branches', required: true }],
    outputs: [],
    ports: (p) => [...branchesOf(p).map((b) => b.id), NONE_PORT],
    validate: (p) => {
      const branches = branchesOf(p)
      const issues: string[] = []
      if (branches.length === 0) issues.push('Añade al menos una rama.')
      branches.forEach((b, i) => {
        if (!b.name?.trim()) issues.push(`La rama ${i + 1} no tiene nombre.`)
        const conditions = (b.groups ?? []).reduce((n, g) => n + g.conditions.length, 0)
        if (conditions === 0)
          issues.push(`La rama ${quote(b.name || String(i + 1))} no tiene condiciones.`)
      })
      if (new Set(branches.map((b) => b.id)).size !== branches.length)
        issues.push('Hay ramas repetidas.')
      return issues
    },
    sentence: (p) => {
      const n = branchesOf(p).length
      return n === 1 ? 'Si se cumple una condición' : `Elegir entre ${n} ramas`
    }
  },
  {
    type: 'wait',
    kind: 'control',
    group: 'control',
    label: 'Esperar',
    description:
      'Retiene la ejecución un tiempo, hasta una fecha o hasta que se cumpla una condición.',
    icon: 'Clock',
    subjects: 'any',
    external: false,
    destructive: false,
    communication: false,
    terminal: false,
    params: WAIT_PARAMS,
    outputs: [],
    ports: (p) => (str(p, 'mode') === 'condition' ? [MET_PORT, TIMEOUT_PORT] : [NEXT_PORT]),
    validate: (p) => {
      const mode = str(p, 'mode')
      if (mode === 'until' && str(p, 'from') === 'fixed' && Number.isNaN(Date.parse(str(p, 'at'))))
        return ['La fecha no es válida.']
      return []
    },
    sentence: (p) => {
      const mode = str(p, 'mode')
      if (mode === 'delay') return `Esperar ${unitText(num(p, 'amount') ?? 0, unitOf(p, 'unit'))}`
      if (mode === 'until') {
        if (str(p, 'from') === 'fixed')
          return `Esperar hasta ${str(p, 'at').replace('T', ' ').slice(0, 16)}`
        const offset = num(p, 'offset') ?? 0
        const field = str(p, 'field') || 'una fecha'
        if (!offset) return `Esperar hasta ${field}`
        const side = str(p, 'direction') === 'before' ? 'antes de' : 'después de'
        return `Esperar hasta ${unitText(offset, unitOf(p, 'offsetUnit'))} ${side} ${field}`
      }
      if (mode === 'condition')
        return `Esperar a que se cumpla, máximo ${unitText(num(p, 'timeout') ?? 0, unitOf(p, 'timeoutUnit'))}`
      return 'Esperar'
    }
  },
  {
    type: 'go_to',
    kind: 'control',
    group: 'control',
    label: 'Ir a',
    description: 'Vuelve a un paso anterior del mismo camino. Solo puede ir al final de una rama.',
    icon: 'CornerUpLeft',
    subjects: 'any',
    external: false,
    destructive: false,
    communication: false,
    terminal: true,
    params: [{ key: 'target', label: 'Paso', kind: 'node', required: true }],
    outputs: [],
    ports: none,
    sentence: (p, names) => `Ir a ${quote(ref(names, 'node', str(p, 'target'), 'un paso'))}`
  },
  {
    type: 'finish',
    kind: 'control',
    group: 'control',
    label: 'Finalizar',
    description: 'Termina la ejecución aquí.',
    icon: 'CircleStop',
    subjects: 'any',
    external: false,
    destructive: false,
    communication: false,
    terminal: true,
    params: [],
    outputs: [],
    ports: none,
    sentence: () => 'Finalizar'
  }
]

const CONTACT_ONLY: SubjectType[] = ['contact']
const CONTACT_OR_PROSPECT: SubjectType[] = ['contact', 'prospect']

const CONTACT_FIELDS = [
  { value: 'name', label: 'Nombre' },
  { value: 'role', label: 'Rol' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'linkedin', label: 'LinkedIn' }
]

const DOMAIN: NodeSpec[] = [
  action({
    type: 'add_tag',
    group: 'contacto',
    label: 'Añadir tag',
    description: 'Añade un tag al contacto.',
    icon: 'Tag',
    subjects: CONTACT_ONLY,
    params: [{ key: 'tag', label: 'Tag', kind: 'tag', required: true }],
    sentence: (p, n) => `Añadir el tag ${quote(ref(n, 'tag', str(p, 'tag'), '…'))}`
  }),
  action({
    type: 'remove_tag',
    group: 'contacto',
    label: 'Quitar tag',
    description: 'Quita un tag del contacto.',
    icon: 'TagX',
    subjects: CONTACT_ONLY,
    params: [{ key: 'tag', label: 'Tag', kind: 'tag', required: true }],
    sentence: (p, n) => `Quitar el tag ${quote(ref(n, 'tag', str(p, 'tag'), '…'))}`
  }),
  action({
    type: 'update_contact',
    group: 'contacto',
    label: 'Actualizar dato',
    description: 'Cambia el nombre, el rol, el teléfono o el LinkedIn del contacto.',
    icon: 'UserPen',
    subjects: CONTACT_ONLY,
    params: [
      { key: 'field', label: 'Dato', kind: 'select', required: true, options: CONTACT_FIELDS },
      { key: 'value', label: 'Valor', kind: 'text', vars: true }
    ],
    sentence: (p) => {
      const field = CONTACT_FIELDS.find((f) => f.value === str(p, 'field'))?.label ?? 'un dato'
      return `Cambiar ${field.toLowerCase()} a ${quote(str(p, 'value'))}`
    }
  }),
  action({
    type: 'set_field',
    group: 'contacto',
    label: 'Guardar campo',
    description: 'Guarda un campo personalizado del contacto.',
    icon: 'RectangleEllipsis',
    subjects: CONTACT_ONLY,
    params: [
      { key: 'key', label: 'Campo', kind: 'text', required: true },
      { key: 'value', label: 'Valor', kind: 'text', vars: true }
    ],
    sentence: (p) => `Guardar ${str(p, 'key') || 'un campo'} = ${quote(str(p, 'value'))}`
  }),
  action({
    type: 'append_contact_note',
    group: 'contacto',
    label: 'Añadir a las notas',
    description: 'Añade un texto al final de las notas del contacto.',
    icon: 'NotebookPen',
    subjects: CONTACT_ONLY,
    params: [{ key: 'text', label: 'Texto', kind: 'markdown', required: true, vars: true }],
    sentence: () => 'Añadir a las notas del contacto'
  }),
  action({
    type: 'assign_client',
    group: 'contacto',
    label: 'Asignar a cliente',
    description: 'Asigna el contacto a un cliente elegido, o al de su empresa si existe o se crea.',
    icon: 'Building',
    subjects: CONTACT_ONLY,
    params: [
      {
        key: 'from',
        label: 'Cliente',
        kind: 'select',
        required: true,
        options: [
          { value: 'pick', label: 'Elegir uno' },
          { value: 'company', label: 'El de su empresa' }
        ]
      },
      {
        key: 'client',
        label: 'Cliente',
        kind: 'client',
        required: true,
        when: { key: 'from', is: ['pick'] }
      }
    ],
    sentence: (p, n) =>
      str(p, 'from') === 'company'
        ? 'Asignar al cliente de su empresa'
        : `Asignar al cliente ${quote(ref(n, 'client', str(p, 'client'), '…'))}`
  }),
  action({
    type: 'unassign_client',
    group: 'contacto',
    label: 'Quitar de su cliente',
    description: 'Desliga el contacto de su cliente.',
    icon: 'Unlink',
    subjects: CONTACT_ONLY,
    params: [],
    sentence: () => 'Quitar de su cliente'
  }),
  action({
    type: 'assign_project',
    group: 'contacto',
    label: 'Asignar a proyecto',
    description: 'Asigna el contacto a un proyecto de su cliente.',
    icon: 'FolderKanban',
    subjects: CONTACT_ONLY,
    params: [{ key: 'project', label: 'Proyecto', kind: 'project', required: true }],
    sentence: (p, n) => `Asignar al proyecto ${quote(ref(n, 'project', str(p, 'project'), '…'))}`
  }),
  action({
    type: 'unsubscribe',
    group: 'contacto',
    label: 'Dar de baja de marketing',
    description: 'Marca al contacto como dado de baja.',
    icon: 'MailX',
    subjects: CONTACT_ONLY,
    params: [],
    sentence: () => 'Dar de baja de marketing'
  }),
  action({
    type: 'delete_contact',
    group: 'contacto',
    label: 'Borrar contacto',
    description: 'Manda el contacto a la papelera.',
    icon: 'UserX',
    subjects: CONTACT_ONLY,
    destructive: true,
    params: [],
    sentence: () => 'Borrar el contacto'
  }),
  action({
    type: 'create_prospect',
    group: 'pipeline',
    label: 'Convertir en prospecto',
    description: 'Crea un prospecto para el contacto en un pipeline y etapa.',
    icon: 'Target',
    subjects: CONTACT_ONLY,
    outputs: [{ key: 'prospectId', label: 'Id del prospecto' }],
    params: [
      { key: 'pipeline', label: 'Pipeline', kind: 'pipeline', required: true },
      { key: 'stage', label: 'Etapa', kind: 'stage', required: true },
      { key: 'value', label: 'Valor en USD', kind: 'number' }
    ],
    sentence: (p, n) => `Convertir en prospecto en ${quote(ref(n, 'stage', str(p, 'stage'), '…'))}`
  }),
  action({
    type: 'move_prospect',
    group: 'pipeline',
    label: 'Mover prospecto',
    description: 'Mueve el prospecto a otra etapa.',
    icon: 'MoveRight',
    subjects: CONTACT_OR_PROSPECT,
    params: [
      { key: 'pipeline', label: 'Pipeline', kind: 'pipeline', required: true },
      { key: 'stage', label: 'Etapa', kind: 'stage', required: true }
    ],
    sentence: (p, n) => `Mover el prospecto a ${quote(ref(n, 'stage', str(p, 'stage'), '…'))}`
  }),
  action({
    type: 'update_prospect',
    group: 'pipeline',
    label: 'Actualizar prospecto',
    description: 'Cambia el valor o el próximo paso del prospecto.',
    icon: 'PencilLine',
    subjects: CONTACT_OR_PROSPECT,
    params: [
      { key: 'value', label: 'Valor en USD', kind: 'number' },
      { key: 'nextStep', label: 'Próximo paso', kind: 'text', vars: true },
      { key: 'inDays', label: 'En cuántos días', kind: 'number', min: 0 }
    ],
    validate: (p) =>
      num(p, 'value') === null && !str(p, 'nextStep') ? ['Indica el valor o el próximo paso.'] : [],
    sentence: () => 'Actualizar el prospecto'
  }),
  action({
    type: 'delete_prospect',
    group: 'pipeline',
    label: 'Borrar prospecto',
    description: 'Manda el prospecto a la papelera.',
    icon: 'Trash',
    subjects: CONTACT_OR_PROSPECT,
    destructive: true,
    params: [],
    sentence: () => 'Borrar el prospecto'
  }),
  action({
    type: 'create_client',
    group: 'clientes',
    label: 'Crear cliente',
    description: 'Crea un cliente desde el prospecto o la empresa del contacto, si no existe.',
    icon: 'Building',
    subjects: CONTACT_OR_PROSPECT,
    outputs: [{ key: 'clientId', label: 'Id del cliente' }],
    params: [{ key: 'name', label: 'Nombre', kind: 'text', vars: true }],
    sentence: (p) =>
      str(p, 'name') ? `Crear el cliente ${quote(str(p, 'name'))}` : 'Crear el cliente'
  }),
  action({
    type: 'create_project',
    group: 'clientes',
    label: 'Crear proyecto',
    description: 'Crea un proyecto en el cliente del sujeto.',
    icon: 'FolderPlus',
    subjects: ['contact', 'prospect', 'client'],
    outputs: [{ key: 'projectId', label: 'Id del proyecto' }],
    params: [{ key: 'name', label: 'Nombre', kind: 'text', required: true, vars: true }],
    sentence: (p) => `Crear el proyecto ${quote(str(p, 'name'))}`
  }),
  action({
    type: 'send_email',
    group: 'email',
    label: 'Enviar email',
    description: 'Envía un email con Resend. Solo a contactos suscritos, con pie de baja.',
    icon: 'Send',
    subjects: CONTACT_ONLY,
    external: true,
    communication: true,
    params: [
      { key: 'subject', label: 'Asunto', kind: 'text', required: true, vars: true },
      { key: 'body', label: 'Cuerpo', kind: 'markdown', required: true, vars: true }
    ],
    sentence: (p) => `Enviar el email ${quote(str(p, 'subject'))}`
  }),
  action({
    type: 'start_sequence',
    group: 'email',
    label: 'Iniciar secuencia',
    description: 'Retirado. Las secuencias de Resend ya no existen; usa Outreach.',
    retired: 'Las secuencias de Resend se retiraron. Quita este paso o usa Outreach.',
    icon: 'ListOrdered',
    subjects: CONTACT_ONLY,
    params: [{ key: 'event', label: 'Evento de la secuencia', kind: 'text', required: true }],
    validate: (p) =>
      str(p, 'event') && !/^[a-zA-Z0-9._-]{1,100}$/.test(str(p, 'event'))
        ? ['El evento solo admite letras, números, puntos, guiones y guiones bajos.']
        : [],
    sentence: (p) => `Iniciar la secuencia ${quote(str(p, 'event'))}`
  }),
  action({
    type: 'email_owner',
    group: 'email',
    label: 'Avisarme por email',
    description: 'Te envía un email a ti.',
    icon: 'MailCheck',
    subjects: 'any',
    external: true,
    communication: true,
    params: [
      { key: 'subject', label: 'Asunto', kind: 'text', required: true, vars: true },
      { key: 'body', label: 'Cuerpo', kind: 'markdown', vars: true }
    ],
    sentence: (p) => `Avisarme por email: ${quote(str(p, 'subject'))}`
  }),
  action({
    type: 'create_task',
    group: 'productividad',
    label: 'Crear tarea',
    description: 'Crea una tarea para ti. Si el día está lleno, va al siguiente con hueco.',
    icon: 'ListTodo',
    subjects: 'any',
    outputs: [{ key: 'taskId', label: 'Id de la tarea' }],
    params: [
      { key: 'title', label: 'Título', kind: 'text', required: true, vars: true },
      { key: 'inDays', label: 'En cuántos días', kind: 'number', min: 0 },
      { key: 'tags', label: 'Tags', kind: 'tags' },
      { key: 'effort', label: 'Esfuerzo', kind: 'effort' },
      { key: 'description', label: 'Descripción', kind: 'markdown', vars: true }
    ],
    sentence: (p) => `Crear la tarea ${quote(str(p, 'title'))}`
  }),
  action({
    type: 'create_note',
    group: 'productividad',
    label: 'Crear nota',
    description: 'Crea una nota, relacionada con el cliente del sujeto si tiene.',
    icon: 'StickyNote',
    subjects: 'any',
    outputs: [{ key: 'noteId', label: 'Id de la nota' }],
    params: [
      { key: 'title', label: 'Título', kind: 'text', required: true, vars: true },
      { key: 'body', label: 'Contenido', kind: 'markdown', vars: true }
    ],
    sentence: (p) => `Crear la nota ${quote(str(p, 'title'))}`
  }),
  action({
    type: 'notify_mac',
    group: 'productividad',
    label: 'Notificación en el Mac',
    description: 'Muestra una notificación en este Mac.',
    icon: 'Bell',
    subjects: 'any',
    params: [
      { key: 'title', label: 'Título', kind: 'text', required: true, vars: true },
      { key: 'body', label: 'Texto', kind: 'text', vars: true }
    ],
    sentence: (p) => `Notificarme: ${quote(str(p, 'title'))}`
  }),
  action({
    type: 'webhook',
    group: 'integraciones',
    label: 'Webhook',
    description:
      'Envía una petición HTTPS. Guarda el código y la respuesta para los pasos siguientes.',
    icon: 'Webhook',
    subjects: 'any',
    external: true,
    outputs: [
      { key: 'status', label: 'Código HTTP' },
      { key: 'body', label: 'Respuesta' }
    ],
    params: [
      {
        key: 'method',
        label: 'Método',
        kind: 'select',
        required: true,
        options: ['POST', 'PUT', 'PATCH', 'GET'].map((m) => ({ value: m, label: m }))
      },
      { key: 'url', label: 'URL', kind: 'url', required: true, vars: true },
      { key: 'body', label: 'Cuerpo JSON', kind: 'markdown', vars: true }
    ],
    validate: (p) => {
      const url = str(p, 'url')
      return url && !url.startsWith('https://') && !url.startsWith('{{')
        ? ['La URL debe empezar por https://.']
        : []
    },
    sentence: (p) => `${str(p, 'method') || 'POST'} a ${str(p, 'url') || 'una URL'}`
  })
]

export const NODES: NodeSpec[] = [...CONTROL, ...DOMAIN]

export const ACTIVE_NODES: NodeSpec[] = NODES.filter((n) => !n.retired)

const NODE_INDEX = new Map(NODES.map((n) => [n.type, n]))

export function nodeSpec(type: NodeType): NodeSpec | undefined {
  return NODE_INDEX.get(type)
}

export function nodeAllowed(spec: NodeSpec, subject: SubjectType): boolean {
  return spec.subjects === 'any' || spec.subjects.includes(subject)
}

export function nodeIssues(spec: NodeSpec, params: Params): string[] {
  if (spec.retired) return [spec.retired]
  return [...required(params, spec.params), ...(spec.validate?.(params) ?? [])]
}

const payload = (event: AutomationEvent, key: string): unknown => event.payload[key]

const same = (wanted: string, actual: unknown): boolean => !wanted || wanted === actual

const optional = (key: string, label: string, kind: ParamKind): ParamSpec => ({ key, label, kind })

const contactTrigger = (
  type: TriggerType,
  label: string,
  description: string,
  icon: string,
  params: ParamSpec[] = [],
  match: (p: Params, e: AutomationEvent) => boolean = () => true,
  sentence: (p: Params, n: Names) => string = () => label
): TriggerSpec => ({
  type,
  group: 'contacto',
  label,
  description,
  icon,
  subject: 'contact',
  params,
  matches: (t, e) => e.type === type && match(t.params, e),
  sentence
})

const pipelineTrigger = (
  type: TriggerType,
  label: string,
  description: string,
  icon: string,
  extra: ParamSpec[] = [],
  match: (p: Params, e: AutomationEvent) => boolean = () => true
): TriggerSpec => ({
  type,
  group: 'pipeline',
  label,
  description,
  icon,
  subject: 'prospect',
  params: [optional('pipeline', 'Pipeline', 'pipeline'), ...extra],
  matches: (t, e) =>
    e.type === type &&
    same(str(t.params, 'pipeline'), payload(e, 'pipelineId')) &&
    match(t.params, e),
  sentence: (p, n) =>
    str(p, 'pipeline') ? `${label} en ${quote(ref(n, 'pipeline', str(p, 'pipeline'), '…'))}` : label
})

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export const TRIGGERS: TriggerSpec[] = [
  contactTrigger(
    'contact.created',
    'Entra un contacto',
    'A mano, por una fuente o desde Claude.',
    'UserPlus',
    [optional('source', 'Fuente', 'text')],
    (p, e) => same(str(p, 'source'), payload(e, 'source')),
    (p) =>
      str(p, 'source') ? `Entra un contacto por ${quote(str(p, 'source'))}` : 'Entra un contacto'
  ),
  contactTrigger(
    'contact.tag_added',
    'Se añade un tag',
    'A un contacto se le añade un tag.',
    'Tag',
    [{ key: 'tag', label: 'Tag', kind: 'tag', required: true }],
    (p, e) => same(str(p, 'tag'), payload(e, 'tag')),
    (p, n) => `Entra el tag ${quote(ref(n, 'tag', str(p, 'tag'), '…'))}`
  ),
  contactTrigger(
    'contact.tag_removed',
    'Se quita un tag',
    'A un contacto se le quita un tag.',
    'TagX',
    [{ key: 'tag', label: 'Tag', kind: 'tag', required: true }],
    (p, e) => same(str(p, 'tag'), payload(e, 'tag')),
    (p, n) => `Sale el tag ${quote(ref(n, 'tag', str(p, 'tag'), '…'))}`
  ),
  contactTrigger(
    'contact.updated',
    'Cambia un contacto',
    'Cambia un dato del contacto.',
    'UserPen',
    [optional('field', 'Dato', 'text')],
    (p, e) => {
      const field = str(p, 'field')
      const fields = payload(e, 'fields')
      return !field || (Array.isArray(fields) && fields.includes(field))
    },
    (p) => (str(p, 'field') ? `Cambia ${str(p, 'field')} del contacto` : 'Cambia un contacto')
  ),
  contactTrigger('contact.subscribed', 'Se suscribe', 'El contacto pasa a suscrito.', 'MailPlus'),
  contactTrigger(
    'contact.unsubscribed',
    'Se da de baja',
    'El contacto se da de baja.',
    'MailMinus'
  ),
  contactTrigger(
    'contact.bounced',
    'Rebota o marca spam',
    'Su email rebota o lo marca como spam.',
    'MailWarning'
  ),
  pipelineTrigger(
    'prospect.created',
    'Se crea un prospecto',
    'Se crea un prospecto en un pipeline.',
    'Target'
  ),
  pipelineTrigger(
    'prospect.stage_changed',
    'Cambia de etapa',
    'Un prospecto pasa de una etapa a otra.',
    'ArrowRightLeft',
    [
      optional('fromStage', 'Desde la etapa', 'stage'),
      optional('toStage', 'Hacia la etapa', 'stage')
    ],
    (p, e) =>
      same(str(p, 'fromStage'), payload(e, 'fromStageId')) &&
      same(str(p, 'toStage'), payload(e, 'toStageId'))
  ),
  pipelineTrigger('prospect.won', 'Se gana un prospecto', 'Llega a una etapa ganada.', 'Trophy'),
  pipelineTrigger(
    'prospect.lost',
    'Se pierde un prospecto',
    'Llega a una etapa perdida.',
    'CircleX'
  ),
  {
    type: 'client.created',
    group: 'clientes',
    label: 'Se crea un cliente',
    description: 'Se crea un cliente nuevo.',
    icon: 'Building',
    subject: 'client',
    params: [],
    matches: (_, e) => e.type === 'client.created',
    sentence: () => 'Se crea un cliente'
  },
  {
    type: 'task.completed',
    group: 'productividad',
    label: 'Se completa una tarea',
    description: 'Se marca una tarea como hecha.',
    icon: 'CircleCheck',
    subject: 'task',
    params: [optional('tag', 'Tag de la tarea', 'text')],
    matches: (t, e) => {
      const tag = str(t.params, 'tag')
      const tags = payload(e, 'tags')
      return e.type === 'task.completed' && (!tag || (Array.isArray(tags) && tags.includes(tag)))
    },
    sentence: (p) =>
      str(p, 'tag') ? `Se completa una tarea con ${quote(str(p, 'tag'))}` : 'Se completa una tarea'
  },
  {
    type: 'meeting.ready',
    group: 'productividad',
    label: 'Reunión lista',
    description: 'Una reunión termina de transcribirse y resumirse.',
    icon: 'AudioLines',
    subject: 'meeting',
    params: [optional('client', 'Cliente', 'client')],
    matches: (t, e) =>
      e.type === 'meeting.ready' && same(str(t.params, 'client'), payload(e, 'clientId')),
    sentence: (p, n) =>
      str(p, 'client')
        ? `Reunión lista con ${quote(ref(n, 'client', str(p, 'client'), '…'))}`
        : 'Reunión lista'
  },
  {
    type: 'schedule',
    group: 'tiempo',
    label: 'Programada',
    description: 'Corre a una hora fija, sin sujeto. Como máximo una vez por hora.',
    icon: 'CalendarClock',
    subject: 'none',
    params: [
      {
        key: 'frequency',
        label: 'Frecuencia',
        kind: 'select',
        required: true,
        options: [
          { value: 'daily', label: 'Cada día' },
          { value: 'weekly', label: 'Cada semana' },
          { value: 'monthly', label: 'Cada mes' }
        ]
      },
      { key: 'time', label: 'Hora', kind: 'time', required: true },
      {
        key: 'weekday',
        label: 'Día de la semana',
        kind: 'select',
        required: true,
        when: { key: 'frequency', is: ['weekly'] },
        options: WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))
      },
      {
        key: 'monthday',
        label: 'Día del mes',
        kind: 'number',
        min: 1,
        required: true,
        when: { key: 'frequency', is: ['monthly'] }
      },
      {
        key: 'skipWeekends',
        label: 'Saltar fines de semana',
        kind: 'boolean',
        when: { key: 'frequency', is: ['daily'] }
      }
    ],
    matches: (t, e, automationId) =>
      e.type === 'schedule' &&
      payload(e, 'automationId') === automationId &&
      payload(e, 'triggerId') === t.id,
    sentence: (p) => {
      const time = str(p, 'time') || '…'
      const f = str(p, 'frequency')
      if (f === 'weekly')
        return `Cada ${WEEKDAYS[num(p, 'weekday') ?? 1]?.toLowerCase()} a las ${time}`
      if (f === 'monthly') return `El día ${num(p, 'monthday') ?? 1} de cada mes a las ${time}`
      return `Cada día a las ${time}`
    }
  },
  {
    type: 'manual',
    group: 'tiempo',
    label: 'A mano',
    description: 'Se ejecuta a mano sobre un sujeto, desde su ficha o desde Claude.',
    icon: 'Hand',
    subject: 'any',
    params: [],
    matches: (_, e, automationId) =>
      e.type === 'manual' && payload(e, 'automationId') === automationId,
    sentence: () => 'Se ejecuta a mano'
  }
]

const TRIGGER_INDEX = new Map(TRIGGERS.map((t) => [t.type, t]))

export function triggerSpec(type: TriggerType): TriggerSpec | undefined {
  return TRIGGER_INDEX.get(type)
}

export function triggerIssues(spec: TriggerSpec, params: Params): string[] {
  return required(params, spec.params)
}

export function triggerAllowed(spec: TriggerSpec, subject: SubjectType): boolean {
  return spec.subject === 'any' || spec.subject === subject
}
