import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { apolloProvider } from '@shared/email-delivery/providers/apollo'
import { saveSettings } from '../main/config'
import { ContactService } from '../main/services/contact.service'
import { OutreachService } from '../main/services/outreach.service'
import { OutreachSync, isInterested } from '../main/services/outreach-sync'
import { ContactModel } from '../main/models/contact.model'
import { ContactEventModel } from '../main/models/marketing.model'
import { TaskModel } from '../main/models/task.model'
import { FakeApollo } from '../main/test/fake-apollo'
import { routerWith } from '../main/test/email-delivery'
import { isolatedConfig, memoryDb } from '../main/test/helpers'

describe('OutreachService y OutreachSync', () => {
  let db: DataSource
  let http: FakeApollo
  let contacts: ContactService
  let outreach: OutreachService
  let sync: OutreachSync

  beforeEach(async () => {
    isolatedConfig()
    saveSettings({ outreachFooter: 'Ali Muñoz Advisory, Hermosillo.', outreachDailyCap: 2 })
    db = await memoryDb()
    http = new FakeApollo()
    const router = routerWith([apolloProvider(http, { footer: () => 'Ali Muñoz Advisory' })], {
      outreach: 'apollo'
    })
    contacts = new ContactService(db)
    outreach = new OutreachService(db, router)
    sync = new OutreachSync(db, router)
  })
  afterEach(() => db.destroy())

  const contact = async (name: string, email: string): Promise<string> =>
    (await contacts.create({ name, email })).id

  it('crea secuencias inactivas y exige confirmación para activar', async () => {
    const s = await outreach.save({
      name: 'Techos',
      emails: [
        { subject: 'Una idea', html: '<p>Hola</p>' },
        { wait: '3 days', subject: '', html: '<p>Sigo</p>' }
      ]
    })
    expect(s.enabled).toBe(false)
    await expect(outreach.setEnabled(s.id, true, false)).rejects.toThrow(/confirm: true/)
    expect((await outreach.setEnabled(s.id, true, true)).enabled).toBe(true)
    await expect(
      outreach.save({
        name: 'x',
        emails: [
          { subject: 'a', html: 'b' },
          { subject: '', html: 'c' }
        ]
      })
    ).rejects.toThrow(/necesita una espera/)
  })

  it('respeta el tope diario, descarta suprimidos y registra la línea de tiempo', async () => {
    const a = await contact('Ana', 'ana@x.com')
    const b = await contact('Bo', 'bo@x.com')
    const c = await contact('Cy', 'cy@x.com')
    const gone = await contact('Ida', 'ida@x.com')
    await contacts.subscribe(gone)
    await contacts.unsubscribe(gone)

    const result = await outreach.enroll({
      sequenceId: 'seq1',
      contactIds: [a, b, c, gone, 'nope']
    })
    expect(result.enrolled).toBe(2)
    expect(result.deferred).toEqual([c])
    expect(result.skipped.map((s) => s.id).sort()).toEqual([gone, 'nope'].sort())
    expect(result.remainingToday).toBe(0)
    expect(http.enrolled[0].contactIds).toHaveLength(2)

    const again = await outreach.enroll({ sequenceId: 'seq1', contactIds: [c] })
    expect(again).toMatchObject({ enrolled: 0, deferred: [c] })
    expect(await db.getRepository(ContactEventModel).countBy({ type: 'outreach_enrolled' })).toBe(2)
    expect((await outreach.status()).sentToday).toBe(2)
  })

  it('aplica bajas como supresión global y vuelve tarea la respuesta con interés', async () => {
    const a = await contact('Ana', 'ana@x.com')
    const b = await contact('Bo', 'bo@x.com')
    http.messages = [
      {
        id: 'm1',
        to_email: 'ana@x.com',
        completed_at: new Date().toISOString(),
        replied: true,
        reply_class: 'willing_to_meet'
      },
      {
        id: 'm2',
        to_email: 'bo@x.com',
        completed_at: new Date().toISOString(),
        reply_class: 'unsubscribe'
      }
    ]
    expect(await sync.poll()).toBe(2)
    expect((await db.getRepository(ContactModel).findOneByOrFail({ id: b })).status).toBe(
      'unsubscribed'
    )
    expect(
      await db.getRepository(ContactEventModel).countBy({ contactId: a, type: 'outreach_reply' })
    ).toBe(1)
    const tasks = await db.getRepository(TaskModel).find()
    expect(tasks.map((t) => t.title)).toContain('Responder a Ana')
    expect(sync.lastError).toBeNull()

    const result = await outreach.enroll({ sequenceId: 'seq1', contactIds: [b] })
    expect(result.skipped[0].reason).toMatch(/baja/)
  })

  it('archivar exige confirmación y saca la secuencia de la lista', async () => {
    const s = await outreach.save({
      name: 'Prueba',
      emails: [{ subject: 'Hola', html: '<p>x</p>' }]
    })
    await expect(outreach.archive(s.id, false)).rejects.toThrow(/confirm: true/)
    expect(await outreach.archive(s.id, true)).toEqual({ ok: true })
    expect((await outreach.list()).map((x) => x.id)).not.toContain(s.id)
  })

  it('el detalle trae asunto, cuerpo y espera de cada paso', async () => {
    const s = await outreach.save({
      name: 'Detalle',
      emails: [
        { subject: 'Hola', html: '<p>Uno</p>' },
        { wait: '2 days', subject: '', html: '<p>Dos</p>', thread: 'reply' }
      ]
    })
    const detail = await outreach.get(s.id)
    expect(detail.steps.map((x) => [x.subject, x.wait, x.thread])).toEqual([
      ['Hola', null, 'new'],
      ['', '2 days', 'reply']
    ])
  })

  it('distingue respuestas con interés', () => {
    expect(isInterested('willing_to_meet')).toBe(true)
    expect(isInterested('follow_up_question')).toBe(true)
    expect(isInterested('not_interested')).toBe(false)
    expect(isInterested('out_of_office')).toBe(false)
    expect(isInterested(null)).toBe(false)
  })
})
