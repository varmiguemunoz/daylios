import {
  NOTIFY_KIND_OF,
  subjectOf,
  type ActivityEntry,
  type ActivityFilter,
  type ActivityState,
  type NotifySettings
} from '@shared/activity'
import type { DataSource } from 'typeorm'
import type { Account } from './account'
import type { ActivityFeed } from './cloud/activity/feed'

interface ActivityDeps {
  db: DataSource
  account: Account
  activeOrg: () => { id: string; name: string } | null
  settings: () => NotifySettings
  saveSettings: (settings: NotifySettings) => void
  memberName: (userId: string | null) => Promise<string>
  alert: (entry: ActivityEntry, text: string) => void
  onState: (state: ActivityState) => void
}

const OFF: ActivityState = { enabled: false, unseen: 0 }

export class Activity {
  private feed: ActivityFeed | null = null

  constructor(private readonly deps: ActivityDeps) {
    deps.account.onChange(() => void this.refresh())
  }

  poke(): void {
    this.feed?.poke()
  }

  async refresh(): Promise<void> {
    const org = this.deps.activeOrg()
    if (!org || !this.deps.account.cloudApi()) {
      if (this.feed) {
        await this.feed.stop()
        this.feed = null
        this.deps.onState(OFF)
      }
      return
    }
    if (this.feed) return
    const { ActivityFeed } = await import('./cloud/activity/feed')
    this.feed = new ActivityFeed({
      db: this.deps.db,
      api: () => this.deps.account.cloudApi(),
      orgId: org.id,
      me: () => this.deps.account.userId(),
      onNew: (entries) => void this.alertMine(entries),
      onState: this.deps.onState
    })
    await this.feed.start()
  }

  state(): Promise<ActivityState> {
    return this.feed?.state() ?? Promise.resolve(OFF)
  }

  list(filter?: ActivityFilter): Promise<ActivityEntry[]> {
    return this.feed?.list(filter) ?? Promise.resolve([])
  }

  markSeen(): Promise<ActivityState> {
    return this.feed?.markSeen() ?? Promise.resolve(OFF)
  }

  async filePath(id: string): Promise<string | null> {
    const rows: { path: string }[] = await this.deps.db.query(
      `SELECT path FROM file_manifest WHERE id = ? AND deleted_at IS NULL`,
      [id]
    )
    return rows[0]?.path ?? null
  }

  notifications(): NotifySettings {
    return this.deps.settings()
  }

  setNotifications(settings: NotifySettings): NotifySettings {
    this.deps.saveSettings(settings)
    return this.deps.settings()
  }

  async stop(): Promise<void> {
    await this.feed?.stop()
  }

  private async alertMine(entries: ActivityEntry[]): Promise<void> {
    const me = this.deps.account.userId()
    if (!me) return
    const settings = this.deps.settings()
    for (const e of entries) {
      const kind = NOTIFY_KIND_OF[e.entity]
      if (e.verb !== 'assigned' || e.targetId !== me || e.actorId === me) continue
      if (!kind || !settings[kind]) continue
      const actor = await this.deps.memberName(e.actorId)
      this.deps.alert(e, `${actor} te asignó ${subjectOf(e)}`)
    }
  }
}
