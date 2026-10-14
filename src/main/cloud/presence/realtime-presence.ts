import type { AccountUser } from '@shared/account'
import {
  PRESENCE_BEAT_MS,
  onlineMembers,
  sameView,
  type PresenceMember,
  type PresenceView
} from '@shared/presence'
import type { PresencePort } from '../../ports'
import type { PresenceChannel } from '../auth'

const TICK_MS = 15_000

export interface RealtimePresenceDeps {
  open: (onSync: (entries: unknown[]) => void) => PresenceChannel | null
  me: () => AccountUser | null
  hidden: () => boolean
}

export class RealtimePresence implements PresencePort {
  private readonly channel: PresenceChannel | null
  private readonly listeners = new Set<(people: PresenceMember[]) => void>()
  private readonly timers: NodeJS.Timeout[]
  private raw: unknown[] = []
  private view: PresenceView | null = null
  private editing = false

  constructor(private readonly deps: RealtimePresenceDeps) {
    this.channel = deps.open((entries) => {
      this.raw = entries
      this.emit()
    })
    this.timers = [
      setInterval(() => this.track(), PRESENCE_BEAT_MS),
      setInterval(() => this.emit(), TICK_MS)
    ]
    this.track()
  }

  announce(view: PresenceView | null, editing: boolean): void {
    const viewSame = view === this.view || sameView(view, this.view)
    if (viewSame && editing === this.editing) return
    this.view = view
    this.editing = editing && !!view
    this.track()
  }

  refreshVisibility(): void {
    this.track()
  }

  members(): PresenceMember[] {
    return onlineMembers(this.raw, this.deps.me()?.id ?? null, Date.now())
  }

  onChange(listener: (people: PresenceMember[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async stop(): Promise<void> {
    for (const t of this.timers) clearInterval(t)
    this.channel?.untrack()
    this.channel?.stop()
    this.listeners.clear()
  }

  private track(): void {
    const me = this.deps.me()
    if (!this.channel || !me) return
    if (this.deps.hidden()) {
      this.channel.untrack()
      return
    }
    this.channel.track({
      userId: me.id,
      name: me.name ?? me.email,
      initials: me.initials,
      view: this.view,
      editing: this.editing,
      at: Date.now()
    })
  }

  private emit(): void {
    const people = this.members()
    for (const l of this.listeners) l(people)
  }
}
