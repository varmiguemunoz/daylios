import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { isolatedConfig, memoryDb } from '../main/test/helpers'
import { ClientService } from '../main/services/client.service'
import { ContactService } from '../main/services/contact.service'
import { TagService } from '../main/services/tag.service'
import { SourceService } from '../main/services/source.service'
import { TaskService } from '../main/services/task.service'
import { ProspectService } from '../main/services/prospect.service'
import { ClientModel } from '../main/models/client.model'
import { maintainDatabase, trimChangeLog } from '../main/db/change-log'

interface LogRow {
  entity: string
  entity_id: string
  op: string
  fields: string | null
}

describe('borrado suave y registro de cambios', () => {
  let db: DataSource
  const log = (entity?: string): Promise<LogRow[]> =>
    db.query(
      `SELECT entity, entity_id, op, fields FROM change_log ${entity ? 'WHERE entity = ?' : ''} ORDER BY seq`,
      entity ? [entity] : []
    )

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
  })
  afterEach(() => db.destroy())

  it('borrar un cliente lo oculta pero la fila sigue con deleted_at', async () => {
    const clients = new ClientService(db)
    const c = await clients.create({ name: 'Acme' })
    await clients.remove(c.id)
    expect((await clients.list()).map((x) => x.id)).not.toContain(c.id)
    await expect(clients.get(c.id)).rejects.toThrow()
    const row = await db
      .getRepository(ClientModel)
      .findOne({ where: { id: c.id }, withDeleted: true })
    expect(row?.deletedAt).toBeTruthy()
  })

  it('cada cambio deja una fila: alta, cambio con sus campos y baja', async () => {
    const clients = new ClientService(db)
    const c = await clients.create({ name: 'Acme' })
    await clients.update(c.id, { sector: 'Energía' })
    await clients.remove(c.id)
    const rows = (await log('clients')).filter((r) => r.entity_id === c.id)
    expect(rows.map((r) => r.op)).toEqual(['insert', 'update', 'delete'])
    expect(rows[1].fields?.split(',')).toEqual(expect.arrayContaining(['sector']))
  })

  it('el secreto de una fuente nunca entra al registro', async () => {
    const sources = new SourceService(db)
    const s = await sources.create({ name: 'Web' })
    await sources.rotateSecret(s.slug)
    const updates = (await log('lead_sources')).filter((r) => r.op === 'update')
    expect(updates.every((r) => !r.fields?.includes('secret'))).toBe(true)
  })

  it('un email o un slug borrados se pueden volver a usar', async () => {
    const contacts = new ContactService(db)
    const first = await contacts.create({ email: 'ana@x.com' })
    await contacts.remove(first.id)
    await expect(contacts.create({ email: 'ana@x.com' })).resolves.toBeTruthy()

    const tags = new TagService(db)
    await contacts.tag((await contacts.create({ email: 'b@x.com' })).id, { add: ['webinar'] })
    await tags.remove('webinar')
    await contacts.tag((await contacts.create({ email: 'c@x.com' })).id, { add: ['webinar'] })
    expect((await tags.list()).map((t) => t.slug)).toContain('webinar')
  })

  it('deshacer el borrado de una tarea la recupera con sus subtareas', async () => {
    const tasks = new TaskService(db)
    const t = await tasks.add('2026-10-13', 'Propuesta')
    await tasks.addSubtask(t.id, 'Precios')
    const removed = await tasks.remove(t.id)
    expect(await tasks.getDay('2026-10-13')).toHaveLength(0)
    await tasks.restore(removed)
    const day = await tasks.getDay('2026-10-13')
    expect(day.map((x) => x.id)).toEqual([t.id])
  })

  it('el pipeline inicial ya no tiene el id fijo de antes', async () => {
    const [first] = await new ProspectService(db).listPipelines()
    expect(first.id).not.toBe('00000000-0000-4000-8000-000000000001')
  })

  it('el mantenimiento recorta el registro en Local', async () => {
    const clients = new ClientService(db)
    for (let i = 0; i < 5; i++) await clients.create({ name: `C${i}` })
    await trimChangeLog(db, 2)
    expect(await log()).toHaveLength(2)
    await expect(maintainDatabase(db, 'local')).resolves.toBeUndefined()
  })
})
