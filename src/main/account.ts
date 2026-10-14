import { hostname } from 'os'
import { join } from 'path'
import {
  DELETE_ACCOUNT_CONFIRMATION,
  type AccountDevice,
  type AccountState,
  type AccountUser
} from '@shared/account'
import type { Edition } from '@shared/edition'
import { cloudEnv, type CloudEnv } from './cloud/env'
import type { AuthService, PresenceChannel } from './cloud/auth'
import type { Cipher } from './cloud/session-storage'
import { CloudApi } from './cloud/cloud-api'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE = /^\d{6,10}$/

interface AccountDeps {
  dataDir: string
  packaged: boolean
  cipher: Cipher
  openExternal: (url: string) => Promise<void>
  deviceId: () => string
  switchEdition: (edition: Edition, auth: AuthService | null) => Promise<void>
  setAuthor: (userId: string | null) => void
  onChanged: (state: AccountState) => void
}

interface ProfileDto {
  name: string | null
}

interface DeviceDto {
  id: string
  name: string
  platform: string
  lastSeenAt: string
}

export class Account {
  private readonly env: CloudEnv | null = cloudEnv()
  private auth: AuthService | null = null
  private api: CloudApi | null = null
  private state: AccountState
  private listeners = new Set<(state: AccountState) => void>()

  constructor(private readonly deps: AccountDeps) {
    this.state = {
      status: 'signed-out',
      user: null,
      waitingFor: null,
      email: null,
      notice: null,
      cloudReady: !!this.env
    }
  }

  current(): AccountState {
    return this.state
  }

  onChange(listener: (state: AccountState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  cloudApi(): CloudApi | null {
    return this.state.status === 'signed-in' ? this.api : null
  }

  subscribe(topic: string, event: string, cb: (payload: unknown) => void): () => void {
    return this.auth?.subscribe(topic, event, cb) ?? (() => undefined)
  }

  presence(
    topic: string,
    key: string,
    onSync: (entries: unknown[]) => void
  ): PresenceChannel | null {
    return this.auth?.presence(topic, key, onSync) ?? null
  }

  userId(): string | null {
    return this.state.status === 'signed-in' ? (this.state.user?.id ?? null) : null
  }

  async init(edition: Edition): Promise<void> {
    if (edition !== 'team' || !this.env) return this.deps.switchEdition('local', null)
    const auth = await this.loadAuth()
    const user = await auth.user()
    await this.deps.switchEdition('team', auth)
    if (user) await this.enter(user)
    else this.set({ status: 'expired', notice: 'Tu sesión terminó. Tus datos siguen aquí.' })
  }

  handleUrl(url: string): boolean {
    return this.auth?.handleUrl(url) ?? false
  }

  async signInWithGoogle(): Promise<AccountState> {
    const auth = await this.loadAuth()
    this.set({ status: 'waiting', waitingFor: 'browser', notice: null })
    try {
      await auth.signInWithGoogle()
      await this.afterSignIn()
    } catch (e) {
      this.back((e as Error).message)
    }
    return this.state
  }

  async sendEmailCode(email: string): Promise<AccountState> {
    const clean = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!EMAIL.test(clean)) return this.set({ notice: 'Escribe un email válido.' })
    const auth = await this.loadAuth()
    try {
      await auth.sendEmailCode(clean)
      return this.set({ status: 'waiting', waitingFor: 'email-code', email: clean, notice: null })
    } catch (e) {
      return this.set({ notice: (e as Error).message })
    }
  }

  async verifyEmailCode(code: string): Promise<AccountState> {
    const clean = typeof code === 'string' ? code.replace(/\s/g, '') : ''
    if (!CODE.test(clean)) return this.set({ notice: 'El código tiene 6 dígitos.' })
    if (!this.auth || !this.state.email) return this.back('Pide un código nuevo.')
    try {
      await this.auth.verifyEmailCode(this.state.email, clean)
      await this.afterSignIn()
    } catch (e) {
      this.set({ notice: (e as Error).message })
    }
    return this.state
  }

  async cancel(): Promise<AccountState> {
    this.auth?.cancelBrowser()
    return this.back(null)
  }

  async signOut(): Promise<AccountState> {
    await this.auth?.signOut()
    await this.leave(null)
    return this.state
  }

  async signOutEverywhere(): Promise<AccountState> {
    if (!this.auth || this.state.status !== 'signed-in') return this.state
    try {
      await this.cloud()
        .call('DELETE', `/me/devices?keep=${this.deps.deviceId()}`)
        .catch(() => undefined)
      await this.auth.signOutOthers()
      return this.set({ notice: 'Cerraste la sesión en los demás dispositivos.' })
    } catch (e) {
      return this.set({ notice: (e as Error).message })
    }
  }

  async rename(name: string): Promise<AccountState> {
    if (!this.state.user) return this.state
    try {
      const profile = await this.cloud().call<ProfileDto>('PATCH', '/me', { name })
      const user = await this.auth?.user(profile.name)
      return this.set({ user: user ?? this.state.user, notice: null })
    } catch (e) {
      return this.set({ notice: (e as Error).message })
    }
  }

  async devices(): Promise<AccountDevice[]> {
    if (this.state.status !== 'signed-in') return []
    const list = await this.cloud().call<DeviceDto[]>('GET', '/me/devices')
    const mine = this.deps.deviceId()
    return list.map((d) => ({ ...d, current: d.id === mine }))
  }

  async deleteAccount(confirm: string): Promise<AccountState> {
    if (confirm !== DELETE_ACCOUNT_CONFIRMATION) {
      return this.set({ notice: `Escribe ${DELETE_ACCOUNT_CONFIRMATION} para confirmar.` })
    }
    try {
      await this.cloud().call('DELETE', '/me', { confirm })
    } catch (e) {
      return this.set({ notice: (e as Error).message })
    }
    await this.auth?.signOut()
    await this.leave('Tu cuenta se borró. Tus datos de este Mac siguen aquí.')
    return this.state
  }

  dispose(): void {
    this.auth?.dispose()
  }

  private async loadAuth(): Promise<AuthService> {
    if (this.auth) return this.auth
    if (!this.env) throw new Error('Esta copia de DayliOS no tiene la nube configurada.')
    const [{ AuthService }, { AuthCallback }, { SecureSessionStorage }] = await Promise.all([
      import('./cloud/auth'),
      import('./cloud/callback'),
      import('./cloud/session-storage')
    ])
    const storage = new SecureSessionStorage(
      join(this.deps.dataDir, 'session.bin'),
      this.deps.cipher
    )
    const auth = new AuthService(
      this.env,
      storage,
      new AuthCallback(this.deps.packaged),
      this.deps.openExternal
    )
    auth.onChange((event) => {
      if ((event === 'refreshed' || event === 'signed-in') && this.state.status === 'expired') {
        void auth.user().then((user) => user && this.enter(user))
        return
      }
      if (event === 'expired' && this.state.status === 'signed-in') {
        this.deps.setAuthor(null)
        this.set({
          status: 'expired',
          notice: 'Tu sesión terminó. Vuelve a entrar; nada se pierde.'
        })
      }
    })
    this.auth = auth
    this.api = new CloudApi(this.env.cloudUrl, () => auth.accessToken())
    return auth
  }

  private cloud(): CloudApi {
    if (!this.api) throw new Error('Inicia sesión primero.')
    return this.api
  }

  private async afterSignIn(): Promise<void> {
    const user = await this.auth?.user()
    if (!user) return void this.back('No se pudo iniciar sesión.')
    await this.deps.switchEdition('team', this.auth)
    await this.enter(user)
  }

  private async enter(user: AccountUser): Promise<void> {
    this.deps.setAuthor(user.id)
    this.set({ status: 'signed-in', user, waitingFor: null, email: null, notice: null })
    const profile = await this.cloud()
      .call<ProfileDto>('GET', '/me')
      .catch(() => null)
    if (profile?.name) {
      const named = await this.auth?.user(profile.name)
      if (named) this.set({ user: named })
    }
    await this.cloud()
      .call('PUT', `/me/devices/${this.deps.deviceId()}`, {
        name: hostname().replace(/\.local$/, ''),
        platform: process.platform === 'darwin' ? 'macos' : process.platform
      })
      .catch(() => undefined)
  }

  private async leave(notice: string | null): Promise<void> {
    this.deps.setAuthor(null)
    await this.deps.switchEdition('local', null)
    this.set({ status: 'signed-out', user: null, waitingFor: null, email: null, notice })
  }

  private back(notice: string | null): AccountState {
    const status = this.state.user ? 'signed-in' : 'signed-out'
    return this.set({ status, waitingFor: null, email: null, notice })
  }

  private set(patch: Partial<AccountState>): AccountState {
    this.state = { ...this.state, ...patch }
    this.deps.onChanged(this.state)
    for (const l of this.listeners) l(this.state)
    return this.state
  }
}
