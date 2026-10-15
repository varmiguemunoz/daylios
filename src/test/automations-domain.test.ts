import { describe, expect, it } from 'vitest'
import {
  describeDefinition,
  emptyDefinition,
  evaluate,
  insert,
  isDestructive,
  nextRun,
  nextRuns,
  NODES,
  NODE_TYPES,
  pickBranch,
  render,
  ROOT_SLOT,
  testCondition,
  TRIGGERS,
  TRIGGER_TYPES,
  triggerSpec,
  TEMPLATES,
  newNode,
  newTrigger,
  portsOf,
  branchesOf,
  validateDefinition,
  type AutomationEvent,
  type Definition,
  type NodeDef,
  type Scope
} from '@shared/automations'

const scope: Scope = {
  now: '2026-10-14T12:00:00.000Z',
  today: '2026-10-14',
  contact: {
    name: 'Ana Pérez',
    first_name: 'Ana',
    email: 'ana@acme.com',
    tags: ['webinar', 'lead'],
    status: 'subscribed',
    createdAt: '2026-10-10T12:00:00.000Z',
    fields: { plan: 'pro' }
  },
  prospect: { value: 1500, open: true },
  steps: { n1: { status: 200, body: '{"ok":true}' } }
}

const node = (id: string, type: NodeDef['type'], params: NodeDef['params'] = {}): NodeDef => ({
  id,
  type,
  name: id,
  params,
  next: {}
})

const base = (): Definition => ({
  ...emptyDefinition('contact'),
  triggers: [{ id: 't1', type: 'contact.tag_added', params: { tag: 'webinar' }, conditions: [] }]
})

describe('catálogo', () => {
  it('cubre todos los tipos sin repetir', () => {
    expect(NODES.map((n) => n.type).sort()).toEqual([...NODE_TYPES].sort())
    expect(TRIGGERS.map((t) => t.type).sort()).toEqual([...TRIGGER_TYPES].sort())
  })

  it('el trigger de tag compara el tag del evento', () => {
    const spec = triggerSpec('contact.tag_added')!
    const trigger = base().triggers[0]
    const event = (tag: string): AutomationEvent => ({
      id: 'e',
      type: 'contact.tag_added',
      subject: { type: 'contact', id: 'c1' },
      payload: { tag },
      createdAt: ''
    })
    expect(spec.matches(trigger, event('webinar'), 'a1')).toBe(true)
    expect(spec.matches(trigger, event('otro'), 'a1')).toBe(false)
  })

  it('manual y programada solo responden a su automatización', () => {
    const manual = triggerSpec('manual')!
    const event: AutomationEvent = {
      id: 'e',
      type: 'manual',
      subject: { type: 'contact', id: 'c1' },
      payload: { automationId: 'a1' },
      createdAt: ''
    }
    const trigger = { id: 't', type: 'manual' as const, params: {}, conditions: [] }
    expect(manual.matches(trigger, event, 'a1')).toBe(true)
    expect(manual.matches(trigger, event, 'a2')).toBe(false)
  })
})

describe('condiciones', () => {
  it('operadores de texto, número, fecha y lista', () => {
    expect(
      testCondition({ field: 'contact.name', operator: 'contains', value: 'pérez' }, scope)
    ).toBe(true)
    expect(
      testCondition({ field: 'contact.email', operator: 'starts_with', value: 'ana' }, scope)
    ).toBe(true)
    expect(testCondition({ field: 'prospect.value', operator: 'gte', value: 1500 }, scope)).toBe(
      true
    )
    expect(
      testCondition(
        { field: 'prospect.value', operator: 'between', value: ['1000', '2000'] },
        scope
      )
    ).toBe(true)
    expect(
      testCondition({ field: 'contact.tags', operator: 'includes', value: 'webinar' }, scope)
    ).toBe(true)
    expect(
      testCondition({ field: 'contact.tags', operator: 'excludes', value: 'cliente' }, scope)
    ).toBe(true)
    expect(
      testCondition({ field: 'contact.createdAt', operator: 'within_days', value: 7 }, scope)
    ).toBe(true)
    expect(
      testCondition({ field: 'contact.createdAt', operator: 'older_than_days', value: 7 }, scope)
    ).toBe(false)
    expect(testCondition({ field: 'prospect.open', operator: 'is', value: true }, scope)).toBe(true)
  })

  it('un campo que falta cuenta como vacío y no rompe', () => {
    expect(testCondition({ field: 'contact.phone', operator: 'is_empty' }, scope)).toBe(true)
    expect(testCondition({ field: 'contact.phone', operator: 'contains', value: '5' }, scope)).toBe(
      false
    )
    expect(testCondition({ field: 'contact.phone', operator: 'is_not', value: '5' }, scope)).toBe(
      true
    )
    expect(testCondition({ field: 'nada.de.nada', operator: 'gt', value: 1 }, scope)).toBe(false)
  })

  it('AND dentro del grupo, OR dentro del grupo y AND entre grupos', () => {
    const yes = { field: 'contact.tags', operator: 'includes' as const, value: 'lead' }
    const no = { field: 'contact.tags', operator: 'includes' as const, value: 'cliente' }
    expect(evaluate([{ join: 'and', conditions: [yes, no] }], scope)).toBe(false)
    expect(evaluate([{ join: 'or', conditions: [yes, no] }], scope)).toBe(true)
    expect(
      evaluate(
        [
          { join: 'or', conditions: [yes] },
          { join: 'or', conditions: [no] }
        ],
        scope
      )
    ).toBe(false)
  })

  it('gana la primera rama que se cumple, y si ninguna, none', () => {
    const lead = {
      join: 'and' as const,
      conditions: [{ field: 'contact.tags', operator: 'includes' as const, value: 'lead' }]
    }
    const pro = {
      join: 'and' as const,
      conditions: [{ field: 'contact.fields.plan', operator: 'is' as const, value: 'pro' }]
    }
    const never = {
      join: 'and' as const,
      conditions: [{ field: 'contact.tags', operator: 'includes' as const, value: 'x' }]
    }
    expect(
      pickBranch(
        [
          { id: 'a', name: 'A', groups: [lead] },
          { id: 'b', name: 'B', groups: [pro] }
        ],
        scope
      )
    ).toBe('a')
    expect(pickBranch([{ id: 'a', name: 'A', groups: [never] }], scope)).toBe('none')
  })
})

describe('plantillas', () => {
  it('resuelve sujeto, salidas de pasos y deja vacío lo desconocido', () => {
    expect(render('Hola {{contact.first_name}}, plan {{ contact.fields.plan }}', scope)).toBe(
      'Hola Ana, plan pro'
    )
    expect(render('Código {{steps.n1.status}}', scope)).toBe('Código 200')
    expect(render('[{{contact.nada}}]', scope)).toBe('[]')
    expect(render('{{contact.tags}}', scope)).toBe('webinar, lead')
  })

  it('escapa HTML cuando se pide', () => {
    expect(render('{{x}}', { x: '<b>"hola"</b>' }, { html: true })).toBe(
      '&lt;b&gt;&quot;hola&quot;&lt;/b&gt;'
    )
  })
})

describe('programadas', () => {
  it('diaria salta fines de semana y semanal cae en su día', () => {
    const friday = new Date(2026, 9, 16, 10, 0)
    const daily = nextRuns({ frequency: 'daily', time: '09:00', skipWeekends: true }, friday, 1)[0]
    expect(daily.getDay()).toBe(1)
    const weekly = nextRun({ frequency: 'weekly', time: '08:30', weekday: '3' }, friday)!
    expect(weekly.getDay()).toBe(3)
    expect(weekly.getHours()).toBe(8)
  })

  it('mensual con día 31 cae en el último día del mes', () => {
    const run = nextRun(
      { frequency: 'monthly', time: '09:00', monthday: 31 },
      new Date(2026, 10, 1)
    )!
    expect(run.getMonth()).toBe(10)
    expect(run.getDate()).toBe(30)
  })

  it('una hora inválida no programa nada', () => {
    expect(nextRun({ frequency: 'daily', time: 'mañana' }, new Date())).toBeNull()
  })
})

describe('validación', () => {
  it('una automatización correcta no tiene errores', () => {
    let def = base()
    def = insert(def, ROOT_SLOT, node('n1', 'add_tag', { tag: 'nurture' }))
    expect(validateDefinition(def)).toEqual([])
    expect(describeDefinition(def)).toBe('Cuando entra el tag «webinar» → añadir el tag «nurture»')
  })

  it('exige trigger, parámetros requeridos y sujeto compatible', () => {
    let def: Definition = { ...emptyDefinition('client') }
    def = insert(def, ROOT_SLOT, node('n1', 'add_tag', {}))
    const messages = validateDefinition(def).map((i) => i.message)
    expect(messages).toContain('Añade al menos un trigger.')
    expect(messages).toContain('Falta tag.')
    expect(messages).toContain('Este paso no aplica a este tipo de sujeto.')
  })

  it('valida referencias contra los datos actuales', () => {
    const def = insert(base(), ROOT_SLOT, node('n1', 'add_tag', { tag: 'borrado' }))
    const issues = validateDefinition(def, { tag: new Set(['webinar']) })
    expect(issues.map((i) => i.message)).toContain('El tag ya no existe.')
  })

  it('ramas sin condiciones y espera por condición sin máximo son errores', () => {
    let def = insert(
      base(),
      ROOT_SLOT,
      node('if', 'if_else', { branches: [{ id: 'b1', name: 'A', groups: [] }] })
    )
    def = insert(
      def,
      { parent: 'if', port: 'none' },
      node('w', 'wait', { mode: 'condition', conditions: [] })
    )
    const messages = validateDefinition(def).map((i) => i.message)
    expect(messages).toContain('La rama «A» no tiene condiciones.')
    expect(messages).toContain('Falta condición.')
    expect(messages).toContain('Falta esperar como máximo.')
  })

  it('una condición con operador que no corresponde al campo es error', () => {
    const def = base()
    def.triggers[0].conditions = [
      { join: 'and', conditions: [{ field: 'prospect.value', operator: 'contains', value: '1' }] }
    ]
    expect(validateDefinition(def).map((i) => i.message)).toContain(
      'El operador no sirve para valor del prospecto.'
    )
  })

  it('marca la automatización como destructiva', () => {
    const def = insert(base(), ROOT_SLOT, node('n1', 'delete_contact'))
    expect(isDestructive(def)).toBe(true)
    expect(isDestructive(base())).toBe(false)
  })
})

describe('plantillas', () => {
  it('todas validan sin errores', () => {
    for (const t of TEMPLATES) expect(validateDefinition(t.build()), t.id).toEqual([])
  })
})

describe('fábrica de nodos', () => {
  it('crea nodos y triggers con valores por defecto válidos', () => {
    const wait = newNode('wait', 'w')
    expect(wait.params).toMatchObject({ mode: 'delay', amount: 1, unit: 'days' })
    const split = newNode('if_else', 's')
    expect(portsOf(split)).toEqual([branchesOf(split.params)[0].id, 'none'])
    expect(newTrigger('schedule', 't').params).toMatchObject({ frequency: 'daily' })
  })
})
