import { beforeEach, describe, expect, it } from 'vitest'
import { handle, sha256, toStatuses, type HubDeps } from './hub'
import { MemoryStore } from './store'
import { FakeResend } from '../../../src/main/test/fake-resend'
import type { HubLeadItem, HubStatusItem } from '../../../src/shared/hub'
import type { Rule } from '../../../src/shared/marketing'

const BASE = 'https://hub.test'
const SECRET = 'secreto-de-la-web'
const ADMIN = 'token-admin'

describe('leads-hub', () => {
  let store: MemoryStore
  let resend: FakeResend
  let deps: HubDeps

  beforeEach(async () => {
    store = new MemoryStore()
    resend = new FakeResend()
    deps = {
      store,
      gateway: resend,
      adminToken: ADMIN,
      verifyWebhook: (payload, headers) => {
        if (headers.get('svix-signature') !== 'ok') throw new Error('bad')
        return JSON.parse(payload)
      }
    }
    await store.putConfig({
      sources: [
        { slug: 'web', name: 'Web', secretHash: await sha256(SECRET), defaultTags: ['newsletter'] }
      ],
      rules: [],
      segments: {}
    })
  })

  const post = (
    path: string,
    body: unknown,
    headers: Record<string, string> = {}
  ): Promise<Response> =>
    handle(
      new Request(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body)
      }),
      deps
    )
  const lead = (body: unknown, secret = SECRET): Promise<Response> =>
    post('/in/web', body, { authorization: `Bearer ${secret}` })

  it('rechaza fuente desconocida, secreto inválido, email inválido y cuerpos grandes', async () => {
    expect(
      (await post('/in/otra', { email: 'a@x.com' }, { authorization: `Bearer ${SECRET}` })).status
    ).toBe(404)
    expect((await lead({ email: 'a@x.com' }, 'mal')).status).toBe(401)
    expect((await post('/in/web', { email: 'a@x.com' })).status).toBe(401)
    expect((await lead({ email: 'no-email' })).status).toBe(400)
    expect((await lead('no es json')).status).toBe(400)
    expect((await lead({ email: 'a@x.com', fields: { bio: 'x'.repeat(70_000) } })).status).toBe(413)
    expect(store.items).toHaveLength(0)
    expect(resend.calls).toBe(0)
  })

  it('acepta el secreto por ?key= (herramientas sin cabeceras)', async () => {
    const res = await post(`/in/web?key=${SECRET}`, { email: 'a@x.com' })
    expect(res.status).toBe(202)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('crea el contacto en Resend con sus segments, dispara eventos y encola', async () => {
    const res = await lead({
      email: ' Ana@X.com ',
      name: 'Ana López',
      tags: ['Webinar'],
      fields: { company: 'Acme' }
    })
    expect(res.status).toBe(202)

    const remote = resend.contacts.get('ana@x.com')!
    expect(remote.firstName).toBe('Ana')
    const segmentNames = [...remote.segments].map((id) => resend.segments.get(id)).sort()
    expect(segmentNames).toEqual(['tag:newsletter', 'tag:origen-web', 'tag:webinar'])
    expect(resend.events.map((e) => e.event)).toEqual([
      'lead.created',
      'tag.origen-web',
      'tag.newsletter',
      'tag.webinar'
    ])

    const [item] = store.items as HubLeadItem[]
    expect(item).toMatchObject({
      kind: 'lead',
      source: 'web',
      lead: { email: 'ana@x.com', name: 'Ana López', fields: { company: 'Acme' } },
      added: ['origen-web', 'newsletter', 'webinar'],
      resend: { ok: true, created: true, unsubscribed: false }
    })
    expect(Object.keys(item.resend.segments).sort()).toEqual([
      'newsletter',
      'origen-web',
      'webinar'
    ])
    // El Worker recuerda los segments creados.
    expect(Object.keys((await store.getConfig()).segments)).toHaveLength(3)
  })

  it('un lead repetido no repite lead.created ni tags que ya tenía', async () => {
    await lead({ email: 'a@x.com' })
    resend.events = []
    await lead({ email: 'a@x.com', tags: ['vip'] })
    expect(resend.events.map((e) => e.event)).toEqual(['tag.vip'])
    const second = store.items[1] as HubLeadItem
    expect(second.added).toEqual(['vip'])
    expect(second.resend.created).toBe(false)
  })

  it('no reactiva ni dispara eventos a quien se dio de baja', async () => {
    await lead({ email: 'a@x.com' })
    resend.contacts.get('a@x.com')!.unsubscribed = true
    resend.events = []
    await lead({ email: 'a@x.com', tags: ['promo'] })
    expect(resend.events).toHaveLength(0)
    expect(resend.contacts.get('a@x.com')!.unsubscribed).toBe(true)
    expect((store.items[1] as HubLeadItem).resend.unsubscribed).toBe(true)
  })

  it('aplica reglas: encadena tags, eventos y promoción', async () => {
    const rule = (id: string, triggerTag: string, actions: Rule['actions']): Rule => ({
      id,
      name: id,
      position: 0,
      active: true,
      triggerTag,
      actions,
      createdAt: '',
      updatedAt: ''
    })
    const config = await store.getConfig()
    await store.putConfig({
      ...config,
      rules: [
        rule('r1', 'webinar', [
          { type: 'add_tag', tag: 'nurture' },
          { type: 'remove_tag', tag: 'newsletter' }
        ]),
        rule('r2', 'nurture', [
          { type: 'fire_event', event: 'nurture.start' },
          { type: 'promote', stage: 'Discovery' }
        ])
      ]
    })
    await lead({ email: 'a@x.com', tags: ['webinar'] })
    const item = store.items[0] as HubLeadItem
    expect(item.added).toEqual(['origen-web', 'webinar', 'nurture'])
    expect(item.promote).toBe('Discovery')
    expect(resend.events.map((e) => e.event)).toContain('nurture.start')
    expect(
      [...resend.contacts.get('a@x.com')!.segments].map((id) => resend.segments.get(id))
    ).not.toContain('tag:newsletter')
  })

  it('si Resend falla, encola igual con ok: false', async () => {
    resend.failNext()
    expect((await lead({ email: 'a@x.com' })).status).toBe(202)
    const item = store.items[0] as HubLeadItem
    expect(item.resend.ok).toBe(false)
    expect(item.resend.error).toMatch(/Fallo simulado/)
    expect(item.added).toEqual(['origen-web', 'newsletter'])
  })

  it('sin RESEND_API_KEY solo encola', async () => {
    deps.gateway = null
    await lead({ email: 'a@x.com' })
    expect((store.items[0] as HubLeadItem).resend).toMatchObject({ ok: false, created: false })
  })

  it('admin: token obligatorio, cola, ack y config', async () => {
    await lead({ email: 'a@x.com' })
    const get = (path: string, token = ADMIN): Promise<Response> =>
      handle(new Request(`${BASE}${path}`, { headers: { authorization: `Bearer ${token}` } }), deps)

    expect((await get('/admin/inbox', 'mal')).status).toBe(401)
    const health = await (await get('/admin/health')).json()
    expect(health).toMatchObject({ ok: true, sources: 1, queued: 1, resend: true, webhooks: true })

    const { items } = (await (await get('/admin/inbox')).json()) as { items: HubLeadItem[] }
    expect(items).toHaveLength(1)
    const ack = await post(
      '/admin/ack',
      { ids: [items[0].id] },
      { authorization: `Bearer ${ADMIN}` }
    )
    expect(await ack.json()).toMatchObject({ removed: 1 })
    expect(store.items).toHaveLength(0)

    const put = await handle(
      new Request(`${BASE}/admin/config`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${ADMIN}` },
        body: JSON.stringify({ sources: [], rules: [], segments: { extra: 'seg_1' } })
      }),
      deps
    )
    const saved = await put.json()
    expect(saved.sources).toEqual([])
    // Fusiona segments: no pierde los que creó el Worker.
    expect(Object.keys(saved.segments)).toEqual(
      expect.arrayContaining(['extra', 'origen-web', 'newsletter'])
    )
  })

  it('webhooks de Resend: verifica la firma y encola bajas, rebotes y quejas', async () => {
    const hook = (body: unknown, signature = 'ok'): Promise<Response> =>
      post('/resend/webhook', body, { 'svix-signature': signature })

    expect((await hook({ type: 'email.bounced' }, 'mal')).status).toBe(401)
    await hook({ type: 'contact.updated', data: { email: 'A@x.com', unsubscribed: true } })
    await hook({ type: 'email.bounced', data: { to: ['b@x.com'], bounce: { type: 'Permanent' } } })
    await hook({ type: 'email.bounced', data: { to: ['c@x.com'], bounce: { type: 'Transient' } } })
    await hook({ type: 'email.complained', data: { to: ['d@x.com'] } })
    await hook({ type: 'email.opened', data: { to: ['e@x.com'] } })

    const statuses = (store.items as HubStatusItem[]).map((i) => [i.email, i.status])
    expect(statuses).toEqual([
      ['a@x.com', 'unsubscribed'],
      ['b@x.com', 'bounced'],
      ['d@x.com', 'complained']
    ])
    expect(
      toStatuses({ type: 'contact.updated', data: { email: 'x@x.com', unsubscribed: false } })
    ).toEqual([])
  })
})
