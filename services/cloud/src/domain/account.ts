export interface Profile {
  userId: string
  name: string | null
  email: string | null
}

export interface Device {
  id: string
  userId: string
  name: string
  platform: string
  lastSeenAt: string
}

export interface Ownership {
  orgId: string
  name: string
  otherMembers: number
}

export const MAX_NAME = 80
export const MAX_DEVICE_NAME = 60
export { DELETE_ACCOUNT_CONFIRMATION as DELETE_CONFIRMATION } from '@shared/account'

export function cleanName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('El nombre debe ser texto.')
  const name = value.replace(/\s+/g, ' ').trim()
  if (!name) throw new Error('Escribe un nombre.')
  if (name.length > MAX_NAME) throw new Error(`El nombre admite hasta ${MAX_NAME} caracteres.`)
  return name
}

export function cleanDeviceName(value: unknown): string {
  const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return (name || 'Mac').slice(0, MAX_DEVICE_NAME)
}

export { initialsOf as initials } from '@shared/account'

export function deletionPlan(owned: Ownership[]): { blockers: Ownership[]; deleteOrgs: string[] } {
  return {
    blockers: owned.filter((o) => o.otherMembers > 0),
    deleteOrgs: owned.filter((o) => o.otherMembers === 0).map((o) => o.orgId)
  }
}
