import { describe, expect, it } from 'vitest'
import {
  apolloProvider,
  toDeliveryEvent,
  toSearch,
  toSteps,
  toWait
} from '@shared/email-delivery/providers/apollo'
import { CapabilityNotSupported, capabilitiesOf } from '@shared/email-delivery'
import { FakeApollo } from '../main/test/fake-apollo'
import { runProviderContract } from '../main/test/email-delivery-contract'

const FOOTER = 'Ali Muñoz Advisory, Hermosillo. Responde «baja» para no recibir más.'
const make = (http = new FakeApollo(), footer = FOOTER): ReturnType<typeof apolloProvider> =>
  apolloProvider(http, { footer: () => footer })

runProviderContract('apollo', () => make())

describe('Apollo', () => {
  it('declara outreach en frío, envío por buzón y sin audiencia ni envío directo', () => {
    const p = make()
    expect(p.policy).toEqual({ coldOutreach: true, sender: 'mailbox' })
    expect(capabilitiesOf(p)).toEqual(['sequences', 'events'])
    expect(p.sequences?.entryModes).toEqual(['enrollment'])
  })

  it('traduce esperas y pasos, con hilo de respuesta cuando no hay asunto', () => {
    expect(toWait('3 days')).toEqual({ wait_time: 3, wait_mode: 'day' })
    expect(toWait('2 weeks')).toEqual({ wait_time: 14, wait_mode: 'day' })
    expect(toWait('4 hours')).toEqual({ wait_time: 4, wait_mode: 'hour' })
    const steps = toSteps([
      { wait: '', subject: 'Hola', html: '<p>1</p>' },
      { wait: '3 days', subject: '', html: '<p>2</p>' }
    ])
    expect(steps.map((s) => [s.type, s.wait_time])).toEqual([
      ['auto_email', 0],
      ['auto_email', 3]
    ])
    expect((steps[1].emailer_touches as { type: string }[])[0].type).toBe('reply_to_thread')
    expect(toSearch({ ids: ['a', 'b'], one: 'x', skip: undefined })).toBe(
      '?ids%5B%5D=a&ids%5B%5D=b&one=x'
    )
  })

  it('crea la secuencia inactiva con horario, pie legal y reglas de parada', async () => {
    const http = new FakeApollo()
    const saved = await make(http).sequences!.save({
      name: 'Techos Phoenix',
      entry: { mode: 'enrollment' },
      steps: [{ wait: '', subject: 'Una idea', html: '<p>Hola</p>' }],
      enabled: true
    })
    expect(saved).toMatchObject({ name: 'Techos Phoenix', enabled: false, emails: 1 })
    const create = http.calls.find((c) => c.path === '/sequences')!.body as Record<string, unknown>
    expect(create).toMatchObject({
      active: false,
      emailer_schedule_id: 'sch1',
      mark_finished_if_reply: true
    })
    expect(JSON.stringify(create.emailer_steps)).toContain('Hermosillo')
  })

  it('sin pie legal crea la secuencia sin añadir nada y por evento no inicia nada', async () => {
    const http = new FakeApollo()
    const p = make(http, '')
    await p.sequences!.save({
      name: 'x',
      entry: { mode: 'enrollment' },
      steps: [{ wait: '', subject: 's', html: '<p>Hola</p>' }],
      enabled: false
    })
    const body = http.calls.find((c) => c.path === '/sequences')!.body as {
      emailer_steps: { emailer_touches: { emailer_template: { body_html: string } }[] }[]
    }
    expect(body.emailer_steps[0].emailer_touches[0].emailer_template.body_html).toBe('<p>Hola</p>')
    await expect(p.sequences!.trigger('tag.x', 'a@x.com')).rejects.toThrow(CapabilityNotSupported)
  })

  it('lee el contenido de cada paso, edita conservando ids y no duplica el pie', async () => {
    const http = new FakeApollo()
    const p = make(http)
    const created = await p.sequences!.save({
      name: 'Techos',
      entry: { mode: 'enrollment' },
      steps: [
        { wait: '', subject: 'Una idea', html: '<p>Hola</p>' },
        { wait: '3 days', subject: '', html: '<p>Sigo</p>', thread: 'reply' }
      ],
      enabled: false
    })
    const detail = await p.sequences!.get(created.id)
    expect(detail.steps.map((s) => [s.position, s.wait, s.subject, s.thread])).toEqual([
      [1, null, 'Una idea', 'new'],
      [2, '3 days', '', 'reply']
    ])
    expect(detail.steps[0].html).toContain('<p>Hola</p>')
    expect(detail.steps[0].html).not.toContain('<body>')

    const [first, second] = detail.steps
    await p.sequences!.save({
      id: created.id,
      name: 'Techos v2',
      entry: { mode: 'enrollment' },
      steps: [
        {
          id: first.key,
          touchId: first.touchId,
          templateId: first.templateId,
          wait: '',
          subject: 'Otra idea',
          html: first.html ?? ''
        },
        {
          id: second.key,
          touchId: second.touchId,
          templateId: second.templateId,
          wait: '4 days',
          subject: '',
          html: second.html ?? '',
          thread: 'reply'
        }
      ],
      enabled: false
    })
    const after = await p.sequences!.get(created.id)
    expect(after.steps.map((s) => s.key)).toEqual([first.key, second.key])
    expect(after.steps.map((s) => s.templateId)).toEqual([first.templateId, second.templateId])
    expect(after.steps[0].subject).toBe('Otra idea')
    expect(after.steps[1].wait).toBe('4 days')
    expect(after.steps[0].html?.match(/Hermosillo/g)).toHaveLength(1)
  })

  it('archiva la secuencia y deja de listarla', async () => {
    const http = new FakeApollo()
    const p = make(http)
    const s = await p.sequences!.save({
      name: 'Borrar',
      entry: { mode: 'enrollment' },
      steps: [{ wait: '', subject: 'x', html: '<p>x</p>' }],
      enabled: false
    })
    await p.sequences!.archive(s.id)
    expect(http.calls.some((c) => c.path === `/emailer_campaigns/${s.id}/archive`)).toBe(true)
    expect((await p.sequences!.list()).map((x) => x.id)).not.toContain(s.id)
  })

  it('inscribe creando contactos con dedupe y rota los buzones activos, el por defecto primero', async () => {
    const http = new FakeApollo()
    const result = await make(http).sequences!.enroll('seq1', {
      contacts: [{ email: 'Ana@x.com', firstName: 'Ana' }, { email: 'bo@x.com' }],
      labels: ['techos']
    })
    expect(result).toEqual({ accepted: 2, skipped: 0 })
    expect(http.enrolled[0]).toMatchObject({
      sequence: 'seq1',
      senders: ['mb2', 'mb1'],
      status: 'active'
    })
    expect(http.contacts.get('ana@x.com')?.label_names).toEqual(['techos'])
    const dedupe = http.calls
      .filter((c) => c.path === '/contacts')
      .map((c) => (c.body as { run_dedupe: boolean }).run_dedupe)
    expect(dedupe).toEqual([true, true])
  })

  it('sin buzones conectados da un error accionable', async () => {
    const http = new FakeApollo()
    http.accounts = []
    await expect(
      make(http).sequences!.enroll('seq1', { contacts: [{ email: 'a@x.com' }] })
    ).rejects.toThrow(/buzón/)
  })

  it('traduce mensajes a eventos y avanza el cursor sin repetir', async () => {
    expect(
      toDeliveryEvent({
        id: 'm1',
        to_email: 'A@x.com',
        completed_at: '2026-10-19T10:00:00Z',
        reply_class: 'unsubscribe'
      })?.type
    ).toBe('unsubscribed')
    expect(
      toDeliveryEvent({
        id: 'm2',
        to_email: 'a@x.com',
        completed_at: '2026-10-19T10:00:00Z',
        replied: true,
        reply_class: 'willing_to_meet'
      })
    ).toMatchObject({ type: 'replied', email: 'a@x.com', detail: { class: 'willing_to_meet' } })
    expect(
      toDeliveryEvent({
        id: 'm3',
        to_email: 'a@x.com',
        completed_at: '2026-10-19T10:00:00Z',
        status: 'bounced'
      })?.type
    ).toBe('bounced')
    expect(
      toDeliveryEvent({
        id: 'm4',
        to_email: 'a@x.com',
        completed_at: '2026-10-19T10:00:00Z',
        status: 'delivered'
      })
    ).toBeNull()

    const http = new FakeApollo()
    http.messages = [
      {
        id: 'm1',
        to_email: 'a@x.com',
        completed_at: '2026-10-19T10:00:00Z',
        replied: true,
        reply_class: 'willing_to_meet'
      },
      { id: 'm2', to_email: 'b@x.com', completed_at: '2026-10-19T11:00:00Z', status: 'bounced' }
    ]
    const source = make(http).events!
    if (source.mode !== 'pull') throw new Error('pull')
    const first = await source.poll('2026-10-19T09:00:00Z')
    expect(first.events.map((e) => e.type)).toEqual(['replied', 'bounced'])
    expect(first.cursor).toBe('2026-10-19T11:00:00Z')
    expect((await source.poll(first.cursor)).events).toEqual([])
  })

  it('clasifica 401 y 403 como fatales', async () => {
    const http = new FakeApollo()
    http.failStatus = 403
    await expect(make(http).test()).rejects.toMatchObject({ provider: 'apollo', kind: 'fatal' })
  })
})
