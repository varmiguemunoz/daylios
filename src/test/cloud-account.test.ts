import { describe, expect, it } from 'vitest'
import {
  cleanName,
  deletionPlan,
  initials,
  type Device,
  type Ownership,
  type Profile
} from '../../services/cloud/src/domain/account'
import {
  DeleteAccount,
  RegisterDevice,
  UpdateProfile
} from '../../services/cloud/src/application/account'
import type {
  AccountAdmin,
  AuthUser,
  DeviceRepository,
  OwnershipRepository,
  ProfileRepository
} from '../../services/cloud/src/ports'

const user: AuthUser = { userId: 'u1', email: 'ana@acme.com' }
const DEVICE = '8f14e45f-ceea-4e7a-9c3f-2b1d8a6f0c11'

describe('perfil', () => {
  it('limpia el nombre y lo exige', () => {
    expect(cleanName('  Ana   María ')).toBe('Ana María')
    expect(() => cleanName('   ')).toThrow(/nombre/)
    expect(() => cleanName('x'.repeat(81))).toThrow(/80/)
  })

  it('iniciales del nombre o, si falta, del email', () => {
    expect(initials('Ana María López', null)).toBe('AL')
    expect(initials('Ana', null)).toBe('AN')
    expect(initials(null, 'miguel@x.com')).toBe('MI')
  })

  it('UpdateProfile rechaza un nombre vacío sin tocar el repositorio', async () => {
    let saved: string | null = null
    const profiles: ProfileRepository = {
      get: async (): Promise<Profile> => ({ userId: 'u1', name: null, email: null }),
      setName: async (_u, name): Promise<Profile> => {
        saved = name
        return { userId: 'u1', name, email: null }
      }
    }
    await expect(new UpdateProfile(profiles).execute(user, { name: ' ' })).rejects.toThrow()
    expect(saved).toBeNull()
    await new UpdateProfile(profiles).execute(user, { name: 'Ana' })
    expect(saved).toBe('Ana')
  })
})

describe('dispositivos', () => {
  const devices: DeviceRepository = {
    list: async () => [],
    touch: async (_u, d): Promise<Device> => ({ ...d, userId: 'u1', lastSeenAt: '' }),
    removeOthers: async () => 0
  }

  it('exige un id de dispositivo válido y pone un nombre por defecto', async () => {
    await expect(new RegisterDevice(devices).execute(user, 'nada', {})).rejects.toThrow()
    const d = await new RegisterDevice(devices).execute(user, DEVICE, { name: '  ' })
    expect(d.name).toBe('Mac')
  })
})

describe('borrar la cuenta', () => {
  const owned = (list: Ownership[]): OwnershipRepository => ({ owned: async () => list })
  const admin = (): AccountAdmin & { orgs: string[]; users: string[] } => {
    const a = {
      orgs: [] as string[],
      users: [] as string[],
      deleteOrganizations: async (ids: string[]) => void a.orgs.push(...ids),
      deleteUser: async (id: string) => void a.users.push(id)
    }
    return a
  }

  it('el plan separa las organizaciones con más miembros', () => {
    const plan = deletionPlan([
      { orgId: 'a', name: 'Sola', otherMembers: 0 },
      { orgId: 'b', name: 'Equipo', otherMembers: 3 }
    ])
    expect(plan.deleteOrgs).toEqual(['a'])
    expect(plan.blockers.map((o) => o.orgId)).toEqual(['b'])
  })

  it('pide la confirmación escrita', async () => {
    const a = admin()
    await expect(new DeleteAccount(owned([]), a).execute(user, 'borrar')).rejects.toThrow(/BORRAR/)
    expect(a.users).toEqual([])
  })

  it('bloquea si es dueña de una organización con más miembros', async () => {
    const a = admin()
    const list = [{ orgId: 'b', name: 'Equipo', otherMembers: 2 }]
    await expect(new DeleteAccount(owned(list), a).execute(user, 'BORRAR')).rejects.toThrow(
      /Equipo/
    )
    expect(a.users).toEqual([])
  })

  it('borra sus organizaciones sin más miembros y la cuenta', async () => {
    const a = admin()
    const list = [{ orgId: 'a', name: 'Sola', otherMembers: 0 }]
    expect(await new DeleteAccount(owned(list), a).execute(user, 'BORRAR')).toEqual({
      deletedOrgs: ['a']
    })
    expect(a.orgs).toEqual(['a'])
    expect(a.users).toEqual(['u1'])
  })
})
