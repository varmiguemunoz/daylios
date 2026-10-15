import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { ContactService } from '../main/services/contact.service'
import { TagService } from '../main/services/tag.service'
import { AutomationService } from '../main/automations/service'
import { insert, ROOT_SLOT } from '@shared/automations'
import { SourceService } from '../main/services/source.service'
import { isolatedConfig, memoryDb } from '../main/test/helpers'

describe('TagService · administración', () => {
  let db: DataSource
  let tags: TagService
  let contacts: ContactService

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
    tags = new TagService(db)
    contacts = new ContactService(db)
  })
  afterEach(() => db.destroy())

  it('borrar quita el tag de contactos y fuentes', async () => {
    const c = await contacts.create({ email: 'ana@x.com' })
    await contacts.tag(c.id, { add: ['webinar'] })
    await new SourceService(db).create({ name: 'Web', defaultTags: ['webinar'] })
    await tags.remove('webinar')
    expect((await contacts.get(c.id)).tags).toEqual([])
    expect((await new SourceService(db).list())[0].defaultTags).toEqual([])
    expect((await tags.list()).map((t) => t.slug)).not.toContain('webinar')
  })

  it('no borra un tag que usa una automatización activa', async () => {
    const c = await contacts.create({ email: 'ana@x.com' })
    await contacts.tag(c.id, { add: ['nurture'] })
    const service = new AutomationService({
      db,
      kick: () => undefined,
      invalidate: () => undefined
    })
    const { automation } = await service.create({ name: 'Nurture', subject: 'contact' })
    await service.saveDraft(automation.id, {
      ...insert(automation.draft, ROOT_SLOT, {
        id: 'a',
        type: 'add_tag',
        name: 'a',
        params: { tag: 'nurture' },
        next: {}
      }),
      triggers: [{ id: 't', type: 'contact.tag_added', params: { tag: 'webinar' }, conditions: [] }]
    })
    await service.publish(automation.id)
    expect((await tags.usage('nurture')).automations).toEqual([
      { id: automation.id, name: 'Nurture', active: true }
    ])
    await expect(tags.remove('nurture')).rejects.toThrow(/Nurture/)
  })
})
