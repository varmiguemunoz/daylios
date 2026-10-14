import {
  MULTIPART_THRESHOLD,
  PART_SIZE,
  SHA256,
  TRASH_DAYS,
  blobKey,
  type CompleteUploadRequest,
  type DownloadResponse,
  type PartUrl,
  type PartUrlsRequest,
  type UploadPlan,
  type UploadRequest,
  type UsageResponse
} from '@shared/files'
import { canWrite, isActive } from '../domain/membership'
import type { AuthUser, BlobRepository, MembershipRepository, ObjectStorage } from '../ports'
import { UseCaseError } from './errors'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_PARTS = 10_000
const UPLOAD_GRACE_DAYS = 7

export class ManageFiles {
  constructor(
    private readonly storage: ObjectStorage,
    private readonly blobs: BlobRepository,
    private readonly memberships: MembershipRepository,
    private readonly maxFileBytes: number
  ) {}

  async requestUpload(user: AuthUser, orgId: string, input: UploadRequest): Promise<UploadPlan> {
    await this.access(user, orgId, true)
    const hash = this.hash(input?.hash)
    const size = this.size(input?.size)
    if (await this.blobs.exists(user, orgId, hash)) return { mode: 'exists' }
    const usage = await this.blobs.usage(user, orgId)
    if (usage.bytes + size > usage.limitBytes) {
      throw new UseCaseError('La organización llegó a su límite de espacio.', 'conflict', usage)
    }
    const key = blobKey(orgId, hash)
    if (size <= MULTIPART_THRESHOLD)
      return { mode: 'single', url: await this.storage.presignPut(key, size) }
    const uploadId = await this.storage.createMultipart(key)
    const count = Math.ceil(size / PART_SIZE)
    return {
      mode: 'multipart',
      uploadId,
      partSize: PART_SIZE,
      parts: await this.presignParts(key, uploadId, range(count))
    }
  }

  async partUrls(
    user: AuthUser,
    orgId: string,
    input: PartUrlsRequest
  ): Promise<{ parts: PartUrl[] }> {
    await this.access(user, orgId, true)
    const hash = this.hash(input?.hash)
    if (typeof input?.uploadId !== 'string' || !input.uploadId)
      throw new UseCaseError('Subida inválida.', 'invalid')
    const numbers = (Array.isArray(input.partNumbers) ? input.partNumbers : []).filter(
      (n) => Number.isInteger(n) && n >= 1 && n <= MAX_PARTS
    )
    return {
      parts: await this.presignParts(blobKey(orgId, hash), input.uploadId, numbers.slice(0, 100))
    }
  }

  async completeUpload(
    user: AuthUser,
    orgId: string,
    input: CompleteUploadRequest
  ): Promise<{ ok: true }> {
    await this.access(user, orgId, true)
    const hash = this.hash(input?.hash)
    const size = this.size(input?.size)
    const key = blobKey(orgId, hash)
    if (input.uploadId) {
      const parts = (input.parts ?? []).filter(
        (p) => Number.isInteger(p.partNumber) && typeof p.etag === 'string'
      )
      if (!parts.length) throw new UseCaseError('Faltan las partes de la subida.', 'invalid')
      await this.storage.completeMultipart(key, input.uploadId, parts)
    }
    const stored = await this.storage.size(key)
    if (stored !== size)
      throw new UseCaseError('El archivo no llegó completo. Vuelve a subirlo.', 'conflict')
    await this.blobs.add(user, orgId, hash, size)
    return { ok: true }
  }

  async download(user: AuthUser, orgId: string, hash: unknown): Promise<DownloadResponse> {
    await this.access(user, orgId, false)
    const clean = this.hash(hash)
    if (!(await this.blobs.exists(user, orgId, clean)))
      throw new UseCaseError('Ese archivo no está en la nube.', 'not-found')
    return { url: await this.storage.presignGet(blobKey(orgId, clean)) }
  }

  async usage(user: AuthUser, orgId: string): Promise<UsageResponse> {
    await this.access(user, orgId, false)
    return { ...(await this.blobs.usage(user, orgId)), maxFileBytes: this.maxFileBytes }
  }

  async purge(): Promise<number> {
    const candidates = await this.blobs.purgeCandidates(UPLOAD_GRACE_DAYS, TRASH_DAYS)
    for (const c of candidates) {
      await this.storage.remove(blobKey(c.orgId, c.hash))
      await this.blobs.forget(c.orgId, c.hash)
    }
    return candidates.length
  }

  private async presignParts(key: string, uploadId: string, numbers: number[]): Promise<PartUrl[]> {
    return Promise.all(
      numbers.map(async (partNumber) => ({
        partNumber,
        url: await this.storage.presignPart(key, uploadId, partNumber)
      }))
    )
  }

  private async access(user: AuthUser, orgId: string, write: boolean): Promise<void> {
    if (typeof orgId !== 'string' || !UUID.test(orgId))
      throw new UseCaseError('Organización inválida.', 'invalid')
    const found = await this.memberships.find(user, orgId)
    const membership = found?.membership ?? null
    if (!isActive(membership))
      throw new UseCaseError('No perteneces a esa organización.', 'not-found')
    if (write && !canWrite(membership))
      throw new UseCaseError('Tu rol es de solo lectura.', 'forbidden')
  }

  private hash(value: unknown): string {
    if (typeof value !== 'string' || !SHA256.test(value))
      throw new UseCaseError('Hash inválido.', 'invalid')
    return value
  }

  private size(value: unknown): number {
    const n = Number(value)
    if (!Number.isSafeInteger(n) || n < 0) throw new UseCaseError('Tamaño inválido.', 'invalid')
    if (n > this.maxFileBytes) {
      throw new UseCaseError(
        `El archivo pasa del máximo de ${Math.round(this.maxFileBytes / 1048576)} MB.`,
        'conflict'
      )
    }
    return n
  }
}

const range = (count: number): number[] => Array.from({ length: count }, (_, i) => i + 1)
