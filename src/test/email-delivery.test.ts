import { describe, expect, it } from 'vitest'
import {
  CapabilityNotSupported,
  DeliveryRouter,
  EmailProviderError,
  ProviderNotConfigured,
  ProviderRegistry,
  RoleNotAssigned,
  RolePolicyViolation,
  canReceive,
  capabilitiesOf,
  checkRoles,
  kindForStatus,
  type EmailProvider,
  type ProviderDescriptor,
  type ProviderInfo,
  type Recipient
} from '@shared/email-delivery'
import {
  RESEND_INFO,
  resendError,
  resendProvider,
  resendWebhookEvents
} from '@shared/email-delivery/providers/resend'
import { FakeResend } from '../main/test/fake-resend'
import { routerWith } from '../main/test/email-delivery'
import { runProviderContract } from '../main/test/email-delivery-contract'

runProviderContract('resend', () => resendProvider(new FakeResend()))

describe('canReceive', () => {
  const r = (status: Recipient['status'], email: string | null = 'a@x.com'): Recipient => ({
    email,
    status
  })

  it('aplica la tabla de verdad por rol', () => {
    const table = {
      transactional: [true, true, true, true, true],
      marketing: [false, true, false, false, false],
      outreach: [true, true, false, false, false]
    }
    const statuses = ['none', 'subscribed', 'unsubscribed', 'bounced', 'complained'] as const
    for (const [role, expected] of Object.entries(table)) {
      statuses.forEach((status, i) =>
        expect(canReceive(role as 'marketing', r(status)).ok, `${role} ${status}`).toBe(expected[i])
      )
      expect(canReceive(role as 'marketing', r('subscribed', null)).ok).toBe(false)
    }
  })
})

describe('errores', () => {
  it('clasifica por status y por código de Resend', () => {
    expect(kindForStatus(null)).toBe('retryable')
    expect(kindForStatus(429)).toBe('retryable')
    expect(kindForStatus(503)).toBe('retryable')
    expect(kindForStatus(422)).toBe('rejected')
    expect(resendError('x', 'invalid_api_key', 401).fatal).toBe(true)
    expect(resendError('x', 'internal_server_error', 500).retryable).toBe(true)
    expect(resendError('x', 'not_found', 404)).toMatchObject({ notFound: true, kind: 'rejected' })
    expect(resendError('x', 'y', 1)).toBeInstanceOf(EmailProviderError)
  })
})

describe('DeliveryRouter', () => {
  const provider = resendProvider(new FakeResend())

  it('resuelve el proveedor y sus puertos por rol', () => {
    const router = routerWith([provider])
    expect(router.use('marketing')).toBe(provider)
    expect(router.audience('marketing')).toBe(provider.audience)
    expect(router.assigned('outreach')).toBeNull()
    expect(router.find('outreach')).toBeNull()
  })

  it('da errores tipados y accionables', () => {
    expect(() => routerWith([provider]).use('outreach')).toThrow(RoleNotAssigned)
    expect(() => routerWith([]).use('marketing')).toThrow(ProviderNotConfigured)
    expect(() => routerWith([]).use('marketing')).toThrow(/API key de Resend/)
    expect(() => routerWith([provider], { outreach: 'resend' }).use('outreach')).toThrow(
      RolePolicyViolation
    )
    expect(() => routerWith([provider], { marketing: 'resend' }).events('marketing')).toThrow(
      CapabilityNotSupported
    )
  })

  it('checkRoles rechaza outreach en un proveedor sin correo en frío', () => {
    const info = (id: string): ProviderInfo | null => (id === 'resend' ? RESEND_INFO : null)
    expect(() => checkRoles({ marketing: 'resend' }, info)).not.toThrow()
    expect(() => checkRoles({ outreach: 'resend' }, info)).toThrow(/no permite correo en frío/)
  })
})

describe('ProviderRegistry', () => {
  it('cachea por huella de credenciales y exige las claves', () => {
    let creds: Record<string, string> | null = { apiKey: 'k1' }
    let created = 0
    const descriptor: ProviderDescriptor = {
      ...RESEND_INFO,
      create: () => (created++, resendProvider(new FakeResend()))
    }
    const registry = new ProviderRegistry([descriptor], () => creds)
    const first = registry.get('resend')
    expect(registry.get('resend')).toBe(first)
    creds = { apiKey: 'k2' }
    expect(registry.get('resend')).not.toBe(first)
    expect(created).toBe(2)
    creds = { apiKey: '' }
    expect(registry.get('resend')).toBeNull()
    expect(registry.configured('resend')).toBe(false)
    expect(
      new DeliveryRouter(registry, () => ({ marketing: 'resend' })).find('marketing')
    ).toBeNull()
  })
})

describe('Resend', () => {
  it('expone eventos solo si hay verificador de webhooks', () => {
    const verify = (payload: string): unknown => JSON.parse(payload)
    expect(capabilitiesOf(resendProvider(new FakeResend()))).not.toContain('events')
    expect(capabilitiesOf(resendProvider(new FakeResend(), { verify }))).toContain('events')
  })

  it('traduce webhooks a eventos de entrega e ignora rebotes temporales', () => {
    let n = 0
    const source = resendWebhookEvents(
      (payload) => JSON.parse(payload),
      () => `id${++n}`,
      () => new Date('2026-10-19T00:00:00Z')
    )
    const headers = { get: () => null }
    const parse = (body: unknown): ReturnType<typeof source.parse> =>
      source.parse(JSON.stringify(body), headers)
    expect(
      parse({ type: 'email.bounced', data: { to: ['B@x.com'], bounce: { type: 'Permanent' } } })
    ).toEqual([
      {
        id: 'id1',
        type: 'bounced',
        email: 'b@x.com',
        at: '2026-10-19T00:00:00.000Z',
        detail: { event: 'email.bounced' }
      }
    ])
    expect(
      parse({ type: 'email.bounced', data: { to: ['c@x.com'], bounce: { type: 'Transient' } } })
    ).toEqual([])
  })

  it('no permite enroll y exige remitente al enviar', async () => {
    const p: EmailProvider = resendProvider(new FakeResend())
    await expect(p.sequences!.enroll('x', { contacts: [{ email: 'a@x.com' }] })).rejects.toThrow(
      CapabilityNotSupported
    )
    await expect(p.sender!.send({ to: 'a@x.com', subject: 's', html: 'h' })).rejects.toThrow(
      /remitente/
    )
  })
})
