export type AuthStatus = 'signed-out' | 'waiting' | 'signed-in' | 'expired'

export interface AccountUser {
  id: string
  email: string | null
  name: string | null
  initials: string
  avatarUrl: string | null
}

export interface AccountState {
  status: AuthStatus
  user: AccountUser | null
  waitingFor: 'browser' | 'email-code' | null
  email: string | null
  notice: string | null
  cloudReady: boolean
}

export interface AccountDevice {
  id: string
  name: string
  platform: string
  lastSeenAt: string
  current: boolean
}

export const ACCOUNT_PROTOCOL = 'daylios'
export const DELETE_ACCOUNT_CONFIRMATION = 'BORRAR'
export const EMAIL_CODE_COOLDOWN_S = 60

export interface AccountApi {
  state(): Promise<AccountState>
  signInWithGoogle(): Promise<AccountState>
  sendEmailCode(email: string): Promise<AccountState>
  verifyEmailCode(code: string): Promise<AccountState>
  cancel(): Promise<AccountState>
  signOut(): Promise<AccountState>
  signOutEverywhere(): Promise<AccountState>
  rename(name: string): Promise<AccountState>
  devices(): Promise<AccountDevice[]>
  deleteAccount(confirm: string): Promise<AccountState>
  onChanged(cb: (state: AccountState) => void): () => void
}

export function initialsOf(name: string | null, email: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (email ?? '?').slice(0, 2).toUpperCase()
}
