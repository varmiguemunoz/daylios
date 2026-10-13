import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { ContactService } from './contact.service'
import { TagService } from './tag.service'
import { RuleService } from './rule.service'
import { SourceService } from './source.service'
import { isolatedConfig, memoryDb } from '../test/helpers'

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

  it('no borra un tag que usa una regla activa', async () => {
    await new RuleService(db).create({
      name: 'Nurture',
      triggerTag: 'webinar',
      actions: [{ type: 'add_tag', tag: 'nurture' }]
    })
    await expect(tags.remove('nurture')).rejects.toThrow(/Nurture/)
  })
})
