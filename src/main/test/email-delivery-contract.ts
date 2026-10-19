import { describe, expect, it } from 'vitest'
import { capabilitiesOf, type EmailProvider } from '@shared/email-delivery'

export function runProviderContract(name: string, make: () => EmailProvider): void {
  const sample = make()

  describe(`contrato de proveedor: ${name}`, () => {
    it('declara identidad, política, límites y al menos una capacidad', () => {
      const p = make()
      expect(p.id).toBeTruthy()
      expect(p.label).toBeTruthy()
      expect(typeof p.policy.coldOutreach).toBe('boolean')
      expect(['domain', 'mailbox']).toContain(p.policy.sender)
      expect(p.limits.minIntervalMs).toBeGreaterThanOrEqual(0)
      expect(capabilitiesOf(p).length).toBeGreaterThan(0)
      expect(p.credentialKeys.length).toBeGreaterThan(0)
    })

    it.skipIf(!sample.sender)('send devuelve un id', async () => {
      const receipt = await make().sender!.send({
        from: 'hola@ejemplo.com',
        to: 'ana@x.com',
        subject: 'Hola',
        html: '<p>Hola</p>'
      })
      expect(typeof receipt.id).toBe('string')
    })

    it.skipIf(!sample.audience)(
      'audience crea, encuentra, actualiza y gestiona grupos',
      async () => {
        const a = make().audience!
        expect(await a.findContact('ana@x.com')).toBeNull()
        const group = await a.ensureGroup('tag:prueba')
        expect(await a.ensureGroup('tag:prueba')).toBe(group)
        await a.createContact({ email: 'ana@x.com', firstName: 'Ana', unsubscribed: false })
        expect(await a.findContact('ana@x.com')).toMatchObject({
          email: 'ana@x.com',
          unsubscribed: false
        })
        await a.updateContact('ana@x.com', { unsubscribed: true })
        expect((await a.findContact('ana@x.com'))?.unsubscribed).toBe(true)
        await a.addToGroup('ana@x.com', group)
        expect((await a.groupsOf('ana@x.com')).map((g) => g.id)).toEqual([group])
        await a.removeFromGroup('ana@x.com', group)
        expect(await a.groupsOf('ana@x.com')).toEqual([])
        await a.deleteGroup(group)
      }
    )

    it.skipIf(!sample.sequences?.authoring)('sequences guarda, lista y activa', async () => {
      const s = make().sequences!
      const entry = s.entryModes.includes('event')
        ? ({ mode: 'event', event: 'tag.prueba' } as const)
        : ({ mode: 'enrollment' } as const)
      const saved = await s.save({
        name: 'Prueba',
        from: 'hola@ejemplo.com',
        entry,
        steps: [{ wait: '', subject: 'Uno', html: '<p>1</p>' }],
        enabled: false
      })
      expect(saved).toMatchObject({ name: 'Prueba', enabled: false, emails: 1 })
      expect((await s.list()).map((x) => x.id)).toContain(saved.id)
      expect((await s.setEnabled(saved.id, true)).enabled).toBe(true)
    })

    it.skipIf(!sample.sequences)(
      'el modo de entrada no soportado falla con un error tipado',
      async () => {
        const s = make().sequences!
        if (!s.entryModes.includes('event'))
          await expect(s.trigger('x', 'ana@x.com')).rejects.toThrow()
        if (!s.entryModes.includes('enrollment'))
          await expect(s.enroll('id', { contacts: [{ email: 'ana@x.com' }] })).rejects.toThrow()
      }
    )
  })
}
