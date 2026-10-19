import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { config, onRolesChanged, publicSettings, saveSettings } from '../main/config'
import '../main/email'
import { ContactService } from '../main/services/contact.service'
import { TagService } from '../main/services/tag.service'
import { MarketingSync } from '../main/services/marketing-sync'
import { resetAudience } from '../main/services/audience-reset'
import { ContactModel } from '../main/models/contact.model'
import { OutboxModel, TagModel } from '../main/models/marketing.model'
import { FakeResend } from '../main/test/fake-resend'
import { routerFor } from '../main/test/email-delivery'
import { isolatedConfig, memoryDb } from '../main/test/helpers'

describe('roles de email en ajustes', () => {
  beforeEach(() => {
    isolatedConfig()
  })

  it('por defecto transaccional y marketing van a Resend y outreach queda libre', () => {
    expect(config.emailRoles()).toEqual({ transactional: 'resend', marketing: 'resend' })
    expect(publicSettings().emailRoles).toEqual(config.emailRoles())
  })

  it('valida rol, proveedor y política de correo en frío', () => {
    expect(() => saveSettings({ emailRoles: { outreach: 'resend' } })).toThrow(
      /no permite correo en frío/
    )
    expect(() => saveSettings({ emailRoles: { marketing: 'otro' } })).toThrow(/desconocido/)
    expect(() =>
      saveSettings({ emailRoles: { spam: 'resend' } as unknown as { marketing: string } })
    ).toThrow(/Rol de email desconocido/)
    expect(config.emailRoles().outreach).toBeUndefined()
  })

  it('quita un rol con null y avisa del cambio', () => {
    const seen: string[] = []
    const off = onRolesChanged((prev, next) => seen.push(`${prev.marketing}>${next.marketing}`))
    saveSettings({ emailRoles: { marketing: null } })
    saveSettings({ emailRoles: { marketing: null } })
    off()
    expect(config.emailRoles()).toEqual({ transactional: 'resend' })
    expect(seen).toEqual(['resend>undefined'])
  })
})

describe('resetAudience', () => {
  let db: DataSource

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
  })
  afterEach(() => db.destroy())

  it('borra los ids remotos y reencola a los contactos con marketing', async () => {
    const contacts = new ContactService(db)
    const ana = await contacts.create({ name: 'Ana', email: 'ana@x.com' })
    await contacts.subscribe(ana.id)
    await contacts.tag(ana.id, { add: ['webinar'] })
    await contacts.create({ name: 'Trabajo', email: 'trabajo@x.com' })
    await new TagService(db).setAudience('webinar', true)
    await new MarketingSync(db, routerFor(new FakeResend())).tick()
    expect(
      (await db.getRepository(TagModel).findOneByOrFail({ slug: 'webinar' })).segmentId
    ).toBeTruthy()

    expect(await resetAudience(db)).toBe(1)
    expect(
      (await db.getRepository(TagModel).findOneByOrFail({ slug: 'webinar' })).segmentId
    ).toBeNull()
    expect(
      (await db.getRepository(ContactModel).findOneByOrFail({ id: ana.id })).syncedAt
    ).toBeNull()
    expect(await db.getRepository(OutboxModel).countBy({ kind: 'contact', ref: ana.id })).toBe(1)
  })
})
