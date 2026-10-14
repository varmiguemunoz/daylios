import type { RecordState } from '@shared/sync-merge'
import type { BootstrapRecord, PulledMutation, SyncMutation } from '@shared/sync-protocol'
import { BURST_MS, type ActivityEntry } from '@shared/activity'
import type { CloudApi } from '../../main/cloud/cloud-api'
import type { ReadActivity } from '../../../services/cloud/src/application/activity'
import type { SyncMutations } from '../../../services/cloud/src/application/sync'
import type { ManageFiles } from '../../../services/cloud/src/application/files'
import type {
  AuthUser,
  BlobRepository,
  MembershipRepository,
  ObjectStorage,
  SyncStore,
  SyncTransaction
} from '../../../services/cloud/src/ports'

export const ORG = '11111111-1111-4111-8111-111111111111'

export class MemoryStore implements SyncStore {
  mutations: PulledMutation[] = []
  ids = new Set<string>()
  states = new Map<string, { entity: string; state: RecordState }>()
  activityLog: ActivityEntry[] = []
  private seq = 0
  private queue = Promise.resolve()

  write<T>(_u: AuthUser, _o: string, work: (tx: SyncTransaction) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> =>
      work({
        insertMutation: async (m: SyncMutation, by: string) => {
          if (this.ids.has(m.mutationId)) return false
          this.ids.add(m.mutationId)
          this.mutations.push({ ...m, cursor: this.mutations.length + 1, by })
          return true
        },
        record: async (entity, id) => this.states.get(`${entity}\u0001${id}`)?.state ?? null,
        saveRecord: async (entity, state) => {
          this.states.set(`${entity}\u0001${state.id}`, { entity, state })
        },
        cursor: async () => this.mutations.length,
        addActivity: async (d, actorId) => {
          const now = Date.now()
          const burst =
            d.verb === 'updated'
              ? [...this.activityLog]
                  .reverse()
                  .find(
                    (e) =>
                      e.verb === 'updated' &&
                      e.actorId === actorId &&
                      e.entity === d.entity &&
                      e.entityId === d.entityId &&
                      now - Date.parse(e.at) < BURST_MS
                  )
              : undefined
          if (burst) {
            Object.assign(burst, {
              count: burst.count + 1,
              seq: ++this.seq,
              at: new Date(now).toISOString(),
              title: d.title
            })
            return
          }
          this.activityLog.push({
            id: this.activityLog.length + 1,
            seq: ++this.seq,
            actorId,
            ...d,
            count: 1,
            at: new Date(now).toISOString()
          })
        }
      })
    const result = this.queue.then(run)
    this.queue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  async pull(_u: AuthUser, _o: string, since: number, limit: number): Promise<PulledMutation[]> {
    return this.mutations.filter((m) => m.cursor > since).slice(0, limit)
  }

  async cursor(): Promise<number> {
    return this.mutations.length
  }

  async activity(_u: AuthUser, _o: string, since: number, limit: number): Promise<ActivityEntry[]> {
    return this.activityLog
      .filter((e) => e.seq > since)
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit)
      .map((e) => ({ ...e }))
  }

  async records(
    _u: AuthUser,
    _o: string,
    after: string | null,
    limit: number
  ): Promise<{ records: BootstrapRecord[]; total: number }> {
    const keys = [...this.states.keys()].sort().filter((k) => !after || k > after)
    return {
      records: keys.slice(0, limit).map((k) => this.states.get(k) as BootstrapRecord),
      total: this.states.size
    }
  }
}

export const member: MembershipRepository = {
  find: async (user) => ({
    org: { id: ORG, name: 'Acme', plan: 'trial', maxMembers: 5 },
    membership: { orgId: ORG, userId: user.userId, role: 'member', status: 'active' }
  })
}

export function fakeApi(
  server: SyncMutations,
  user: AuthUser,
  files?: ManageFiles,
  activity?: ReadActivity
): CloudApi {
  return {
    call: async (method: string, path: string, body?: unknown) => {
      const url = new URL(path, 'http://cloud.test')
      if (method === 'POST' && url.pathname === '/sync/push')
        return server.push(user, body as never)
      const [, root, org, action, extra] = url.pathname.split('/')
      if (root === 'activity' && activity)
        return activity.list(user, org, url.searchParams.get('since'))
      if (root === 'files' && files) {
        if (action === 'uploads' && !extra) return files.requestUpload(user, org, body as never)
        if (action === 'uploads' && extra === 'parts')
          return files.partUrls(user, org, body as never)
        if (action === 'uploads' && extra === 'complete')
          return files.completeUpload(user, org, body as never)
        if (action === 'blobs') return files.download(user, org, extra)
        if (action === 'usage') return files.usage(user, org)
      }
      if (action === 'pull') return server.pull(user, org, url.searchParams.get('since'))
      if (action === 'bootstrap') return server.bootstrap(user, org, url.searchParams.get('after'))
      throw new Error(`Ruta desconocida ${path}`)
    }
  } as unknown as CloudApi
}

export class MemoryObjectStorage implements ObjectStorage {
  objects = new Map<string, Buffer>()
  parts = new Map<string, Map<number, Buffer>>()
  puts = 0
  private seq = 0

  async presignPut(key: string): Promise<string> {
    return `mem://obj/${encodeURIComponent(key)}`
  }

  async createMultipart(key: string): Promise<string> {
    const id = `up${++this.seq}`
    this.parts.set(id, new Map())
    this.parts.get(id)?.set(0, Buffer.from(key))
    return id
  }

  async presignPart(_key: string, uploadId: string, partNumber: number): Promise<string> {
    return `mem://part/${uploadId}/${partNumber}`
  }

  async completeMultipart(
    key: string,
    uploadId: string,
    parts: { partNumber: number }[]
  ): Promise<void> {
    const stored = this.parts.get(uploadId)
    if (!stored) throw new Error('Subida desconocida')
    const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber)
    this.objects.set(
      key,
      Buffer.concat(sorted.map((p) => stored.get(p.partNumber) ?? Buffer.alloc(0)))
    )
    this.parts.delete(uploadId)
  }

  async presignGet(key: string): Promise<string> {
    return `mem://obj/${encodeURIComponent(key)}`
  }

  async size(key: string): Promise<number | null> {
    return this.objects.get(key)?.length ?? null
  }

  async remove(key: string): Promise<void> {
    this.objects.delete(key)
  }

  fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input)
    const body = init?.body ? Buffer.from(init.body as Uint8Array) : Buffer.alloc(0)
    if (url.startsWith('mem://obj/')) {
      const key = decodeURIComponent(url.slice('mem://obj/'.length))
      if (init?.method === 'PUT') {
        this.puts++
        this.objects.set(key, body)
        return new Response(null, { status: 200, headers: { etag: '"x"' } })
      }
      const data = this.objects.get(key)
      return data ? new Response(new Uint8Array(data)) : new Response(null, { status: 404 })
    }
    if (url.startsWith('mem://part/')) {
      const [uploadId, n] = url.slice('mem://part/'.length).split('/')
      const stored = this.parts.get(uploadId)
      if (!stored) return new Response(null, { status: 404 })
      this.puts++
      stored.set(Number(n), body)
      return new Response(null, { status: 200, headers: { etag: `"p${n}"` } })
    }
    return new Response(null, { status: 404 })
  }
}

export class MemoryBlobs implements BlobRepository {
  blobs = new Map<string, number>()

  async exists(_u: AuthUser, orgId: string, hash: string): Promise<boolean> {
    return this.blobs.has(`${orgId}:${hash}`)
  }

  async add(_u: AuthUser, orgId: string, hash: string, size: number): Promise<void> {
    this.blobs.set(`${orgId}:${hash}`, size)
  }

  async usage(): Promise<{ bytes: number; limitBytes: number }> {
    return { bytes: [...this.blobs.values()].reduce((a, b) => a + b, 0), limitBytes: 5 * 1024 ** 3 }
  }

  async purgeCandidates(): Promise<{ orgId: string; hash: string }[]> {
    return []
  }

  async forget(orgId: string, hash: string): Promise<void> {
    this.blobs.delete(`${orgId}:${hash}`)
  }
}
