import { cpSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  INVITE_PATH,
  type ActiveWorkspace,
  type Authorship,
  type InvitePreview,
  type InviteInput,
  type InviteResult,
  type OrgDetail,
  type OrgMember,
  type OrgsState,
  type OrgSummary,
  type Role
} from '@shared/organizations'
import { ACCOUNT_PROTOCOL, type AccountState } from '@shared/account'
import type { DataSource } from 'typeorm'
import type { Account } from './account'
import type { CloudApi } from './cloud/cloud-api'

interface OrgsDeps {
  account: Account
  db: DataSource
  userData: string
  active: () => { id: string; name: string } | null
  saveActive: (org: { id: string; name: string } | null) => void
  paths: (orgId: string) => { data: string; docs: string } | null
  trash: (path: string) => Promise<void>
  relaunch: (notice: string | null) => void
  openAccount: () => void
  workspacePath: () => string
  markerName: string
  onChanged: (state: OrgsState) => void
}

const INVITE_LINK = new RegExp(`^${ACCOUNT_PROTOCOL}://${INVITE_PATH}/([A-Za-z0-9_-]{20,100})$`)

export class Organizations {
  private orgs: OrgSummary[] = []
  private notice: string | null = null
  private pendingInvite: string | null = null
  private membersCache: { orgId: string; list: OrgMember[] } | null = null

  constructor(private readonly deps: OrgsDeps) {
    deps.account.onChange((state) => this.onAccount(state))
  }

  state(): OrgsState {
    return { active: this.active(), orgs: this.orgs, notice: this.notice }
  }

  async init(): Promise<void> {
    if (!this.deps.account.cloudApi()) {
      const signedOut = this.deps.account.current().status === 'signed-out'
      if (signedOut && this.deps.active()) this.leaveTo(null, null)
      return
    }
    await this.refresh()
  }

  async refresh(): Promise<OrgsState> {
    const api = this.deps.account.cloudApi()
    if (!api) return this.emit()
    try {
      this.orgs = await api.call<OrgSummary[]>('GET', '/orgs')
    } catch (e) {
      return this.emit((e as Error).message)
    }
    const active = this.deps.active()
    if (active) {
      const still = this.orgs.find((o) => o.id === active.id)
      if (!still) {
        this.leaveTo(null, `Ya no perteneces a «${active.name}». Volviste a Local.`)
        return this.state()
      }
      if (still.name !== active.name) this.deps.saveActive({ id: still.id, name: still.name })
    }
    return this.emit(null)
  }

  async create(name: string, bringLocal = false): Promise<OrgsState> {
    const org = await this.api().call<OrgSummary>('POST', '/orgs', { name })
    this.orgs = [...this.orgs.filter((o) => o.id !== org.id), org]
    this.emit(null)
    await this.open({ id: org.id, name: org.name }, 'seed', bringLocal && !this.deps.active())
    return this.state()
  }

  async switchTo(orgId: string | null): Promise<void> {
    const current = this.deps.active()?.id ?? null
    if (current === orgId) return
    const org = orgId ? this.orgs.find((o) => o.id === orgId) : null
    if (orgId && !org) throw new Error('Esa organización no está en tu lista.')
    if (!org) return this.leaveTo(null, null)
    await this.open({ id: org.id, name: org.name }, 'join', false)
  }

  private async open(
    org: { id: string; name: string },
    mode: 'seed' | 'join',
    bringLocal: boolean
  ): Promise<void> {
    const data = join(this.deps.userData, 'orgs', org.id)
    const fresh = !existsSync(join(data, 'daylios.db'))
    mkdirSync(data, { recursive: true })
    const localWorkspace = this.deps.workspacePath()
    if (fresh) {
      writeFileSync(join(data, this.deps.markerName), JSON.stringify({ mode }), { mode: 0o600 })
      if (bringLocal) await this.deps.db.query('VACUUM INTO ?', [join(data, 'daylios.db')])
    }
    this.deps.saveActive(org)
    const docs = this.deps.paths(org.id)?.docs
    if (fresh && bringLocal && docs && existsSync(localWorkspace)) {
      cpSync(localWorkspace, join(docs, 'Workspace'), { recursive: true, force: false })
    }
    this.deps.relaunch(null)
  }

  async detail(): Promise<OrgDetail | null> {
    const active = this.deps.active()
    const api = this.deps.account.cloudApi()
    if (!active || !api) return null
    const detail = await api.call<OrgDetail>('GET', `/orgs/${active.id}`)
    this.membersCache = { orgId: active.id, list: detail.members }
    return detail
  }

  async members(): Promise<OrgMember[]> {
    const active = this.deps.active()
    if (!active) return []
    if (this.membersCache?.orgId === active.id) return this.membersCache.list
    return (await this.detail())?.members ?? []
  }

  rename(name: string): Promise<OrgDetail> {
    return this.change('PATCH', '', { name }).then(async (d) => {
      await this.refresh()
      return d
    })
  }

  async remove(confirmName: string): Promise<void> {
    const id = this.requireActive().id
    await this.api().call('DELETE', `/orgs/${id}`, { confirm: confirmName })
    await this.forgetCopy(id, 'La organización se borró.')
  }

  transfer(userId: string): Promise<OrgDetail> {
    return this.change('POST', '/transfer', { userId })
  }

  invite(input: InviteInput): Promise<InviteResult> {
    return this.api().call<InviteResult>(
      'POST',
      `/orgs/${this.requireActive().id}/invitations`,
      input
    )
  }

  resendInvite(id: string): Promise<InviteResult> {
    return this.api().call<InviteResult>(
      'POST',
      `/orgs/${this.requireActive().id}/invitations/${encodeURIComponent(id)}/resend`
    )
  }

  revokeInvite(id: string): Promise<OrgDetail> {
    return this.change('DELETE', `/invitations/${encodeURIComponent(id)}`)
  }

  changeRole(userId: string, role: Role): Promise<OrgDetail> {
    return this.change('PATCH', `/members/${encodeURIComponent(userId)}`, { role })
  }

  removeMember(userId: string): Promise<OrgDetail> {
    return this.change('DELETE', `/members/${encodeURIComponent(userId)}`)
  }

  async leave(): Promise<void> {
    const org = this.requireActive()
    await this.api().call('POST', `/orgs/${org.id}/leave`)
    await this.forgetCopy(
      org.id,
      `Saliste de «${org.name}». Su copia local se movió a la Papelera.`
    )
  }

  async authorship(table: string, id: string): Promise<Authorship> {
    if (!/^[a-z_]+$/.test(table)) return { createdBy: null, updatedBy: null }
    const rows: { op: string; by: string | null }[] = await this.deps.db.query(
      `SELECT op, by FROM change_log WHERE entity = ? AND entity_id = ? AND by IS NOT NULL ORDER BY seq`,
      [table, id]
    )
    const created = rows.find((r) => r.op === 'insert')
    return { createdBy: created?.by ?? null, updatedBy: rows.at(-1)?.by ?? null }
  }

  handleUrl(url: string): boolean {
    const match = INVITE_LINK.exec(url)
    if (!match) return false
    this.pendingInvite = match[1]
    if (this.deps.account.cloudApi()) void this.acceptPending()
    else {
      this.emit('Inicia sesión para aceptar la invitación.')
      this.deps.openAccount()
    }
    return true
  }

  async previewInvite(token: string): Promise<InvitePreview> {
    return this.api().call<InvitePreview>('GET', `/invitations/${encodeURIComponent(token)}`)
  }

  private async acceptPending(): Promise<void> {
    const token = this.pendingInvite
    if (!token) return
    this.pendingInvite = null
    try {
      const org = await this.api().call<OrgSummary>(
        'POST',
        `/invitations/${encodeURIComponent(token)}/accept`
      )
      this.orgs = [...this.orgs.filter((o) => o.id !== org.id), org]
      this.emit(`Entraste a «${org.name}».`)
      this.deps.openAccount()
    } catch (e) {
      this.emit((e as Error).message)
      this.deps.openAccount()
    }
  }

  private onAccount(state: AccountState): void {
    if (state.status === 'signed-in') {
      void this.refresh().then(() => this.acceptPending())
    } else if (state.status === 'signed-out') {
      this.orgs = []
      this.membersCache = null
      if (this.deps.active()) this.leaveTo(null, null)
      else this.emit()
    }
  }

  private async change(method: string, suffix: string, body?: unknown): Promise<OrgDetail> {
    const id = this.requireActive().id
    const detail = await this.api().call<OrgDetail>(method, `/orgs/${id}${suffix}`, body)
    this.membersCache = { orgId: id, list: detail.members }
    return detail
  }

  private async forgetCopy(orgId: string, notice: string): Promise<void> {
    const paths = this.deps.paths(orgId)
    this.orgs = this.orgs.filter((o) => o.id !== orgId)
    this.deps.saveActive(null)
    if (paths) {
      await this.deps.db.destroy().catch(() => undefined)
      for (const path of [paths.data, paths.docs]) {
        if (existsSync(path)) await this.deps.trash(path).catch(() => undefined)
      }
    }
    this.deps.relaunch(notice)
  }

  private leaveTo(org: { id: string; name: string } | null, notice: string | null): void {
    this.deps.saveActive(org)
    this.deps.relaunch(notice)
  }

  private active(): ActiveWorkspace {
    const org = this.deps.active()
    return org ? { orgId: org.id, name: org.name } : { orgId: null, name: 'Local' }
  }

  private requireActive(): { id: string; name: string } {
    const org = this.deps.active()
    if (!org) throw new Error('Elige una organización primero.')
    return org
  }

  private api(): CloudApi {
    const api = this.deps.account.cloudApi()
    if (!api) throw new Error('Inicia sesión primero.')
    return api
  }

  private emit(notice?: string | null): OrgsState {
    if (notice !== undefined) this.notice = notice
    const state = this.state()
    this.deps.onChanged(state)
    return state
  }
}
