import {
  DELETE_CONFIRMATION,
  cleanDeviceName,
  cleanName,
  deletionPlan,
  type Device,
  type Ownership,
  type Profile
} from '../domain/account'
import type {
  AccountAdmin,
  AuthUser,
  DeviceRepository,
  OwnershipRepository,
  ProfileRepository
} from '../ports'

import { UseCaseError as AccountError, invalid } from './errors'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class UpdateProfile {
  constructor(private readonly profiles: ProfileRepository) {}

  async execute(user: AuthUser, input: { name?: unknown }): Promise<Profile> {
    return this.profiles.setName(
      user,
      invalid(() => cleanName(input?.name))
    )
  }
}

export class RegisterDevice {
  constructor(private readonly devices: DeviceRepository) {}

  async execute(
    user: AuthUser,
    id: string,
    input: { name?: unknown; platform?: unknown }
  ): Promise<Device> {
    if (!UUID.test(id)) throw new AccountError('Dispositivo inválido.', 'invalid')
    const platform = typeof input?.platform === 'string' ? input.platform.slice(0, 20) : 'macos'
    return this.devices.touch(user, { id, name: cleanDeviceName(input?.name), platform })
  }
}

export class ListDevices {
  constructor(private readonly devices: DeviceRepository) {}

  execute(user: AuthUser): Promise<Device[]> {
    return this.devices.list(user)
  }
}

export class ForgetOtherDevices {
  constructor(private readonly devices: DeviceRepository) {}

  async execute(user: AuthUser, keepId: string): Promise<number> {
    if (!UUID.test(keepId)) throw new AccountError('Dispositivo inválido.', 'invalid')
    return this.devices.removeOthers(user, keepId)
  }
}

export class DeleteAccount {
  constructor(
    private readonly ownership: OwnershipRepository,
    private readonly admin: AccountAdmin
  ) {}

  async execute(user: AuthUser, confirm: unknown): Promise<{ deletedOrgs: string[] }> {
    if (confirm !== DELETE_CONFIRMATION) {
      throw new AccountError(`Escribe ${DELETE_CONFIRMATION} para confirmar.`, 'invalid')
    }
    const plan = deletionPlan(await this.ownership.owned(user))
    if (plan.blockers.length) {
      throw new AccountError(
        `Eres dueño de ${names(plan.blockers)}, con más miembros. Transfiere o borra esas organizaciones antes.`,
        'conflict',
        plan.blockers
      )
    }
    if (plan.deleteOrgs.length) await this.admin.deleteOrganizations(plan.deleteOrgs)
    await this.admin.deleteUser(user.userId)
    return { deletedOrgs: plan.deleteOrgs }
  }
}

const names = (list: Ownership[]): string => list.map((o) => `«${o.name}»`).join(', ')
