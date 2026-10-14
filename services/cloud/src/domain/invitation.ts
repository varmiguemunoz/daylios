import { createHash, randomBytes } from 'crypto'
import { INVITE_TTL_DAYS, type InvitationStatus, type Role } from '@shared/organizations'

export interface Invitation {
  id: string
  orgId: string
  email: string | null
  role: Role
  tokenHash: string
  invitedBy: string
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
  createdAt: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DAY_MS = 86_400_000

export const newInviteToken = (): string => randomBytes(32).toString('base64url')

export const hashInviteToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex')

export const inviteExpiry = (now: number): string =>
  new Date(now + INVITE_TTL_DAYS * DAY_MS).toISOString()

export function invitationStatus(inv: Invitation, now: number): InvitationStatus {
  if (inv.acceptedAt) return 'accepted'
  if (inv.revokedAt) return 'revoked'
  if (Date.parse(inv.expiresAt) <= now) return 'expired'
  return 'pending'
}

export function cleanInviteEmail(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') throw new Error('El email debe ser texto.')
  const email = value.trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 254) throw new Error('Escribe un email válido.')
  return email
}

export type AcceptProblem = 'not-found' | 'accepted' | 'revoked' | 'expired' | 'email-mismatch'

export function acceptProblem(
  inv: Invitation | null,
  userEmail: string | null,
  now: number
): AcceptProblem | null {
  if (!inv) return 'not-found'
  const status = invitationStatus(inv, now)
  if (status !== 'pending') return status
  if (inv.email && inv.email !== (userEmail ?? '').toLowerCase()) return 'email-mismatch'
  return null
}

export const ACCEPT_MESSAGE: Record<AcceptProblem, string> = {
  'not-found': 'Esa invitación no existe.',
  accepted: 'Esa invitación ya se usó.',
  revoked: 'La invitación fue revocada. Pide una nueva.',
  expired: 'La invitación caducó. Pide que te la reenvíen.',
  'email-mismatch': 'La invitación es para otro email. Entra con esa cuenta.'
}
