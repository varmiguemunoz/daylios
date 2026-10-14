import { describe, expect, it } from 'vitest'
import { encodeHlc } from '@shared/hlc'
import { capabilitiesFor } from '../../services/cloud/src/domain/entitlements'
import {
  canManageMembers,
  canWrite,
  type Membership
} from '../../services/cloud/src/domain/membership'
import { rejectReason } from '../../services/cloud/src/domain/mutation-policy'

const org = { id: 'o1', name: 'Ali Muñoz', plan: 'trial', maxMembers: 5 }
const member = (role: Membership['role'], status: Membership['status'] = 'active'): Membership => ({
  orgId: 'o1',
  userId: 'u1',
  role,
  status
})

describe('roles y permisos', () => {
  it('solo dueño y administradores gestionan miembros; el lector no escribe', () => {
    expect(canManageMembers(member('admin'))).toBe(true)
    expect(canManageMembers(member('member'))).toBe(false)
    expect(canWrite(member('viewer'))).toBe(false)
    expect(canWrite(member('member', 'removed'))).toBe(false)
  })

  it('sin membresía activa no hay funciones de equipo', () => {
    expect(capabilitiesFor(org, null)).toEqual([])
    expect(capabilitiesFor(org, member('owner', 'removed'))).toEqual([])
    expect(capabilitiesFor(org, member('member'))).not.toContain('org.invite')
    expect(capabilitiesFor(org, member('owner'))).toContain('org.invite')
  })
})

describe('mutaciones', () => {
  const now = 1_000_000
  const ok = {
    entity: 'clients',
    id: 'c1',
    op: 'upsert' as const,
    fields: { name: 'Acme' },
    rev: encodeHlc({ ms: now, counter: 0, node: 'mac' })
  }

  it('acepta una mutación válida', () => {
    expect(rejectReason(ok, now)).toBeNull()
  })

  it('rechaza tablas y columnas que nunca se sincronizan', () => {
    expect(rejectReason({ ...ok, entity: 'resend_outbox' }, now)).toMatch(/no sincronizable/)
    expect(rejectReason({ ...ok, entity: 'lead_sources', fields: { secret: 'x' } }, now)).toMatch(
      /secret/
    )
    expect(rejectReason({ ...ok, fields: { org_id: 'otra' } }, now)).toMatch(/org_id/)
  })

  it('rechaza relojes adelantados y revisiones rotas', () => {
    const ahead = encodeHlc({ ms: now + 10 * 60_000, counter: 0, node: 'mac' })
    expect(rejectReason({ ...ok, rev: ahead }, now)).toMatch(/adelantado/)
    expect(rejectReason({ ...ok, rev: 'nada' }, now)).toMatch(/inválida/)
  })
})
