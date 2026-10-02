import { beforeEach, describe, expect, it } from 'vitest'
import { SequenceService } from './sequence.service'
import { FakeResend } from '../test/fake-resend'
import { isolatedConfig } from '../test/helpers'
import { saveSettings } from '../config'

describe('SequenceService', () => {
  let resend: FakeResend
  let sequences: SequenceService

  beforeEach(() => {
    isolatedConfig()
    saveSettings({ fromEmail: 'hola@ejemplo.com', fromName: 'Ali' })
    resend = new FakeResend()
    sequences = new SequenceService(() => resend)
  })

  const input = {
    name: 'Webinar',
    event: 'tag.webinar',
    emails: [
      { subject: 'Gracias por venir', html: '<p>Hola</p>' },
      { wait: '2 days', subject: 'La grabación', html: '<p>Aquí está</p>' },
      {
        wait: '1 week',
        subject: '¿Hablamos?',
        html: '<p>Agenda <a href="{{{RESEND_UNSUBSCRIBE_URL}}}">x</a></p>'
      }
    ]
  }

  it('crea templates con pie de baja y una automation lineal pausada', async () => {
    const s = await sequences.save(input)
    expect(s).toMatchObject({
      name: 'Webinar',
      status: 'disabled',
      event: 'tag.webinar',
      emails: 3
    })

    const a = resend.automations.get(s.id)!
    expect(a.steps.map((x) => `${x.type}:${x.key}`)).toEqual([
      'trigger:start',
      'send_email:email_1',
      'delay:wait_2',
      'send_email:email_2',
      'delay:wait_3',
      'send_email:email_3'
    ])
    expect(a.connections).toEqual([
      { from: 'start', to: 'email_1' },
      { from: 'email_1', to: 'wait_2' },
      { from: 'wait_2', to: 'email_2' },
      { from: 'email_2', to: 'wait_3' },
      { from: 'wait_3', to: 'email_3' }
    ])
    const html = [...resend.templates.values()].map((t) => t.html)
    expect(html.every((h) => h.includes('{{{RESEND_UNSUBSCRIBE_URL}}}'))).toBe(true)
    expect(html[2].match(/RESEND_UNSUBSCRIBE_URL/g)).toHaveLength(1) // no duplica el pie

    expect((await sequences.list()).map((x) => x.id)).toEqual([s.id])
    expect((await sequences.get(s.id)).steps.filter((x) => x.wait).map((x) => x.wait)).toEqual([
      '2 days',
      '1 week'
    ])
  })

  it('valida la entrada y no edita una secuencia activa', async () => {
    await expect(sequences.save({ ...input, event: 'tag webinar' })).rejects.toThrow(/El evento/)
    await expect(sequences.save({ ...input, emails: [] })).rejects.toThrow(/al menos un email/)
    await expect(
      sequences.save({ ...input, emails: [{ wait: 'mañana', subject: 'x', html: '<p>x</p>' }] })
    ).rejects.toThrow(/espera/)

    const s = await sequences.save({ ...input, enabled: true })
    expect(s.status).toBe('enabled')
    await expect(sequences.save({ ...input, id: s.id })).rejects.toThrow(/Páusala/)
    await sequences.setStatus(s.id, false)
    const edited = await sequences.save({ ...input, id: s.id, emails: input.emails.slice(0, 1) })
    expect(edited.emails).toBe(1)
  })

  it('sin remitente o sin API key da un error claro', async () => {
    saveSettings({ fromEmail: '' })
    await expect(sequences.save(input)).rejects.toThrow(/remitente/)
    await expect(new SequenceService(() => null).list()).rejects.toThrow(/API key/)
  })
})
