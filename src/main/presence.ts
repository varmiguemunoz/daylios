import { presenceTopic, type PresenceState, type PresenceView } from '@shared/presence'
import type { Account } from './account'
import type { RealtimePresence } from './cloud/presence/realtime-presence'

interface PresenceDeps {
  account: Account
  activeOrg: () => { id: string; name: string } | null
  hidden: () => boolean
  saveHidden: (hidden: boolean) => void
  onState: (state: PresenceState) => void
}

export class Presence {
  private adapter: RealtimePresence | null = null
  private orgId: string | null = null
  private view: PresenceView | null = null
  private editing = false

  constructor(private readonly deps: PresenceDeps) {
    deps.account.onChange(() => void this.refresh())
  }

  state(): PresenceState {
    return {
      enabled: !!this.adapter,
      hidden: this.deps.hidden(),
      members: this.adapter?.members() ?? []
    }
  }

  async refresh(): Promise<void> {
    const org = this.deps.activeOrg()
    const user = this.deps.account.current().user
    if (!org || !user || !this.deps.account.cloudApi()) return this.close()
    if (org.id !== this.orgId) await this.close()
    if (this.adapter) return
    const { RealtimePresence } = await import('./cloud/presence/realtime-presence')
    this.orgId = org.id
    this.adapter = new RealtimePresence({
      open: (onSync) => this.deps.account.presence(presenceTopic(org.id), user.id, onSync),
      me: () => this.deps.account.current().user,
      hidden: this.deps.hidden
    })
    this.adapter.onChange(() => this.deps.onState(this.state()))
    this.adapter.announce(this.view, this.editing)
    this.deps.onState(this.state())
  }

  setView(view: PresenceView | null): void {
    this.view = view
    this.editing = false
    this.adapter?.announce(view, false)
  }

  setEditing(editing: boolean): void {
    this.editing = editing
    this.adapter?.announce(this.view, editing)
  }

  setHidden(hidden: boolean): PresenceState {
    this.deps.saveHidden(hidden)
    this.adapter?.refreshVisibility()
    const state = this.state()
    this.deps.onState(state)
    return state
  }

  async stop(): Promise<void> {
    await this.close()
  }

  private async close(): Promise<void> {
    if (!this.adapter) return
    const adapter = this.adapter
    this.adapter = null
    this.orgId = null
    await adapter.stop()
    this.deps.onState(this.state())
  }
}
