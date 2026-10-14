import {
  BOOTSTRAP_PAGE,
  MAX_PUSH_BATCH,
  PULL_PAGE,
  type BootstrapResponse,
  type PullResponse,
  type PushRequest,
  type PushResponse
} from '@shared/sync-protocol'
import { applyMutation, visible } from '@shared/sync-merge'
import { describeChange, type StageLookup } from '../domain/activity'
import { canWrite, isActive } from '../domain/membership'
import { rejectReason } from '../domain/mutation-policy'
import type { AuthUser, ChangeNotifier, Clock, MembershipRepository, SyncStore } from '../ports'
import { UseCaseError } from './errors'

const MUTATION_ID = /^[A-Za-z0-9:_-]{8,120}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class SyncMutations {
  constructor(
    private readonly store: SyncStore,
    private readonly memberships: MembershipRepository,
    private readonly notifier: ChangeNotifier,
    private readonly clock: Clock
  ) {}

  async push(user: AuthUser, req: PushRequest): Promise<PushResponse> {
    const orgId = this.org(req?.orgId)
    const found = await this.memberships.find(user, orgId)
    if (!isActive(found?.membership ?? null))
      throw new UseCaseError('No perteneces a esa organización.', 'not-found')
    if (!canWrite(found?.membership ?? null))
      throw new UseCaseError('Tu rol es de solo lectura.', 'forbidden')
    const list = Array.isArray(req.mutations) ? req.mutations : []
    if (list.length > MAX_PUSH_BATCH) {
      throw new UseCaseError(`Máximo ${MAX_PUSH_BATCH} cambios por envío.`, 'invalid')
    }
    const now = this.clock.now()
    const rejected: PushResponse['rejected'] = []
    const valid = list.filter((m) => {
      const reason = !MUTATION_ID.test(String(m?.mutationId ?? ''))
        ? 'Id de cambio inválido.'
        : rejectReason(m, now)
      if (reason) rejected.push({ mutationId: String(m?.mutationId ?? ''), reason })
      return !reason
    })
    const result = await this.store.write(user, orgId, async (tx) => {
      let applied = 0
      const stage: StageLookup = async (id) => {
        const row = id ? visible(await tx.record('pipeline_stages', id)) : null
        return row ? { name: String(row.name ?? ''), kind: String(row.kind ?? '') } : null
      }
      for (const m of valid) {
        if (!(await tx.insertMutation(m, user.userId))) continue
        const before = await tx.record(m.entity, m.id)
        const state = applyMutation(before, m)
        await tx.saveRecord(m.entity, state)
        if (req.quiet !== true) {
          for (const draft of await describeChange(m, before, state, stage)) {
            await tx.addActivity(draft, user.userId)
          }
        }
        applied++
      }
      return { applied, cursor: await tx.cursor() }
    })
    if (result.applied) await this.notifier.changes(orgId, result.cursor).catch(() => undefined)
    return { ...result, rejected }
  }

  async pull(user: AuthUser, orgId: string, since: unknown): Promise<PullResponse> {
    await this.member(user, this.org(orgId))
    const from = Number.isSafeInteger(Number(since)) && Number(since) >= 0 ? Number(since) : 0
    const page = await this.store.pull(user, orgId, from, PULL_PAGE + 1)
    const more = page.length > PULL_PAGE
    const mutations = more ? page.slice(0, PULL_PAGE) : page
    const cursor = mutations.length ? mutations[mutations.length - 1].cursor : from
    return { mutations, cursor, more }
  }

  async bootstrap(user: AuthUser, orgId: string, after: unknown): Promise<BootstrapResponse> {
    await this.member(user, this.org(orgId))
    const key = typeof after === 'string' && after ? after.slice(0, 300) : null
    const cursor = await this.store.cursor(user, orgId)
    const { records, total } = await this.store.records(user, orgId, key, BOOTSTRAP_PAGE + 1)
    const more = records.length > BOOTSTRAP_PAGE
    const page = more ? records.slice(0, BOOTSTRAP_PAGE) : records
    const last = page[page.length - 1]
    return {
      records: page,
      after: more && last ? `${last.entity}\u0001${last.state.id}` : null,
      cursor,
      total
    }
  }

  private org(value: unknown): string {
    if (typeof value !== 'string' || !UUID.test(value))
      throw new UseCaseError('Organización inválida.', 'invalid')
    return value
  }

  private async member(user: AuthUser, orgId: string): Promise<void> {
    const found = await this.memberships.find(user, orgId)
    if (!isActive(found?.membership ?? null))
      throw new UseCaseError('No perteneces a esa organización.', 'not-found')
  }
}
