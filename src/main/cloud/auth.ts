import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js'
import { initialsOf, type AccountUser } from '@shared/account'
import type { Identity, IdentityPort } from '../ports'
import type { AuthCallback } from './callback'
import type { CloudEnv } from './env'
import type { SecureSessionStorage } from './session-storage'

const BROWSER_TIMEOUT_MS = 5 * 60_000

export interface PresenceChannel {
  track(payload: Record<string, unknown>): void
  untrack(): void
  stop(): void
}

export type AuthEvent = 'signed-in' | 'signed-out' | 'expired' | 'refreshed'

export class AuthService implements IdentityPort {
  private readonly client: SupabaseClient
  private listeners = new Set<(event: AuthEvent) => void>()
  private leaving = false

  constructor(
    env: CloudEnv,
    private readonly storage: SecureSessionStorage,
    private readonly callback: AuthCallback,
    private readonly openExternal: (url: string) => Promise<void>
  ) {
    this.client = createClient(env.supabaseUrl, env.anonKey, {
      auth: {
        flowType: 'pkce',
        storage,
        storageKey: 'daylios-auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
    this.client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') this.emit('signed-in')
      else if (event === 'TOKEN_REFRESHED') this.emit('refreshed')
      else if (event === 'SIGNED_OUT') {
        this.emit(this.leaving ? 'signed-out' : 'expired')
        this.leaving = false
      }
    })
  }

  onChange(listener: (event: AuthEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: AuthEvent): void {
    for (const l of this.listeners) l(event)
  }

  private async session(): Promise<Session | null> {
    const { data } = await this.client.auth.getSession()
    return data.session
  }

  async current(): Promise<Identity | null> {
    const user = (await this.session())?.user
    return user ? { userId: user.id, email: user.email ?? '', name: displayName(user) } : null
  }

  async user(profileName?: string | null): Promise<AccountUser | null> {
    const user = (await this.session())?.user
    if (!user) return null
    const name = profileName ?? displayName(user)
    const avatar = user.user_metadata?.avatar_url
    return {
      id: user.id,
      email: user.email ?? null,
      name,
      initials: initialsOf(name, user.email ?? null),
      avatarUrl: typeof avatar === 'string' && avatar.startsWith('https://') ? avatar : null
    }
  }

  async accessToken(): Promise<string | null> {
    return (await this.session())?.access_token ?? null
  }

  async signIn(): Promise<Identity> {
    await this.signInWithGoogle()
    const identity = await this.current()
    if (!identity) throw new Error('No se pudo iniciar sesión.')
    return identity
  }

  async signInWithGoogle(): Promise<void> {
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: this.callback.redirectUrl(),
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' }
      }
    })
    if (error || !data.url) throw new Error(error?.message ?? 'No se pudo abrir el acceso.')
    const code = this.callback.wait(BROWSER_TIMEOUT_MS)
    await this.openExternal(data.url)
    const exchanged = await this.client.auth.exchangeCodeForSession(await code)
    if (exchanged.error) throw new Error(friendly(exchanged.error.message))
  }

  cancelBrowser(): void {
    this.callback.cancel()
  }

  handleUrl(url: string): boolean {
    return this.callback.handleUrl(url)
  }

  async sendEmailCode(email: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true }
    })
    if (error) throw new Error(friendly(error.message))
  }

  async verifyEmailCode(email: string, code: string): Promise<void> {
    const { error } = await this.client.auth.verifyOtp({ email, token: code, type: 'email' })
    if (error) throw new Error(friendly(error.message))
  }

  async signOut(): Promise<void> {
    this.leaving = true
    await this.client.auth.signOut({ scope: 'local' }).catch(() => undefined)
    this.storage.clear()
  }

  async signOutOthers(): Promise<void> {
    const { error } = await this.client.auth.signOut({ scope: 'others' })
    if (error) throw new Error(friendly(error.message))
  }

  subscribe(topic: string, event: string, cb: (payload: unknown) => void): () => void {
    const channel = this.client
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event }, (message) => cb(message.payload))
    void this.accessToken().then((token) => {
      if (token) this.client.realtime.setAuth(token)
      channel.subscribe()
    })
    return () => {
      void this.client.removeChannel(channel)
    }
  }

  presence(topic: string, key: string, onSync: (entries: unknown[]) => void): PresenceChannel {
    const channel = this.client.channel(topic, { config: { private: true, presence: { key } } })
    channel.on('presence', { event: 'sync' }, () =>
      onSync(Object.values(channel.presenceState()).flat())
    )
    let pending: Record<string, unknown> | null = null
    let joined = false
    void this.accessToken().then((token) => {
      if (token) this.client.realtime.setAuth(token)
      channel.subscribe((status) => {
        joined = status === 'SUBSCRIBED'
        if (joined && pending) void channel.track(pending)
      })
    })
    return {
      track: (payload) => {
        pending = payload
        if (joined) void channel.track(payload)
      },
      untrack: () => {
        pending = null
        if (joined) void channel.untrack()
      },
      stop: () => {
        void this.client.removeChannel(channel)
      }
    }
  }

  dispose(): void {
    this.callback.cancel()
    void this.client.auth.stopAutoRefresh()
  }
}

const displayName = (user: User): string | null => {
  const meta = user.user_metadata ?? {}
  const name = meta.full_name ?? meta.name
  return typeof name === 'string' && name.trim() ? name.trim() : null
}

function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('expired') || m.includes('invalid'))
    return 'El código no vale o caducó. Pide otro.'
  if (m.includes('rate limit') || m.includes('security purposes'))
    return 'Demasiados intentos. Espera un minuto y vuelve a probar.'
  if (m.includes('network') || m.includes('fetch')) return 'No hay conexión. Revisa tu red.'
  return message
}
