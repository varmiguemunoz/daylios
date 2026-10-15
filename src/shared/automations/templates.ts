import { insert } from './graph'
import {
  emptyDefinition,
  ROOT_SLOT,
  type Definition,
  type NodeDef,
  type SubjectType,
  type TriggerDef
} from './model'

export interface AutomationTemplate {
  id: string
  name: string
  description: string
  subject: SubjectType
  build(): Definition
}

const step = (
  id: string,
  type: NodeDef['type'],
  name: string,
  params: NodeDef['params']
): NodeDef => ({
  id,
  type,
  name,
  params,
  next: {}
})

function chain(subject: SubjectType, trigger: TriggerDef, nodes: NodeDef[]): Definition {
  let def: Definition = { ...emptyDefinition(subject), triggers: [trigger] }
  let slot = ROOT_SLOT
  for (const node of nodes) {
    def = insert(def, slot, node)
    slot = { parent: node.id, port: 'next' }
  }
  return def
}

export const TEMPLATES: AutomationTemplate[] = [
  {
    id: 'welcome',
    name: 'Bienvenida a suscriptores',
    description: 'Email de bienvenida, espera dos días y lo marca para nurture.',
    subject: 'contact',
    build: () =>
      chain('contact', { id: 't1', type: 'contact.subscribed', params: {}, conditions: [] }, [
        step('n1', 'send_email', 'Email de bienvenida', {
          subject: 'Bienvenido, {{contact.first_name}}',
          body: 'Hola {{contact.first_name}}, gracias por suscribirte.'
        }),
        step('n2', 'wait', 'Esperar 2 días', { mode: 'delay', amount: 2, unit: 'days' }),
        step('n3', 'add_tag', 'Pasar a nurture', { tag: 'nurture' })
      ])
  },
  {
    id: 'won',
    name: 'Prospecto ganado a cliente',
    description: 'Al ganar un prospecto crea el cliente y una tarea de kickoff para mañana.',
    subject: 'prospect',
    build: () =>
      chain('prospect', { id: 't1', type: 'prospect.won', params: {}, conditions: [] }, [
        step('n1', 'create_client', 'Crear cliente', {}),
        step('n2', 'create_task', 'Tarea de kickoff', {
          title: 'Kickoff con {{prospect.company}}',
          inDays: 1
        })
      ])
  },
  {
    id: 'weekly',
    name: 'Revisión semanal del pipeline',
    description: 'Cada lunes a las 9 crea una tarea para revisar el pipeline.',
    subject: 'none',
    build: () =>
      chain(
        'none',
        {
          id: 't1',
          type: 'schedule',
          params: { frequency: 'weekly', weekday: '1', time: '09:00' },
          conditions: []
        },
        [step('n1', 'create_task', 'Revisar pipeline', { title: 'Revisar el pipeline', inDays: 0 })]
      )
  }
]
