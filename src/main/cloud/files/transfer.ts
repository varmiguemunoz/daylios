import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import { mkdir, open, rename, rm } from 'fs/promises'
import { dirname } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { PART_SIZE, TEMP_SUFFIX, type PartUrl, type UploadPlan } from '@shared/files'
import type { CloudApi } from '../cloud-api'

export interface UploadProgress {
  get(
    hash: string
  ): Promise<{ uploadId: string; done: { partNumber: number; etag: string }[] } | null>
  save(hash: string, uploadId: string, done: { partNumber: number; etag: string }[]): Promise<void>
  clear(hash: string): Promise<void>
}

const TIMEOUT_MS = 120_000

async function readRange(full: string, start: number, length: number): Promise<Buffer> {
  const handle = await open(full, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, start)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

async function put(url: string, body: Buffer): Promise<string> {
  const res = await fetch(url, {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: { 'Content-Length': String(body.length) },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  }).catch(() => {
    throw new Error('No hay conexión con la nube de Alisuite.')
  })
  if (!res.ok) throw new Error(`El almacén rechazó la subida (${res.status}).`)
  return (res.headers.get('etag') ?? '').replace(/"/g, '')
}

export async function upload(
  api: CloudApi,
  orgId: string,
  full: string,
  hash: string,
  size: number,
  progress: UploadProgress
): Promise<void> {
  const base = `/files/${orgId}/uploads`
  const saved = await progress.get(hash)
  let uploadId = saved?.uploadId
  let done = saved?.done ?? []
  let partSize = 0
  let urls: PartUrl[] = []

  if (!uploadId) {
    const plan = await api.call<UploadPlan>('POST', base, { hash, size })
    if (plan.mode === 'exists') return
    if (plan.mode === 'single') {
      await put(plan.url, await readRange(full, 0, size))
      await api.call('POST', `${base}/complete`, { hash, size })
      return
    }
    uploadId = plan.uploadId
    partSize = plan.partSize
    urls = plan.parts
    done = []
    await progress.save(hash, uploadId, done)
  }

  partSize ||= PART_SIZE
  const count = Math.ceil(size / partSize)
  const missing = Array.from({ length: count }, (_, i) => i + 1).filter(
    (n) => !done.some((d) => d.partNumber === n)
  )
  if (missing.length && !urls.length) {
    for (let i = 0; i < missing.length; i += 100) {
      const res = await api.call<{ parts: PartUrl[] }>('POST', `${base}/parts`, {
        hash,
        uploadId,
        partNumbers: missing.slice(i, i + 100)
      })
      urls.push(...res.parts)
    }
  }
  for (const n of missing) {
    const url = urls.find((u) => u.partNumber === n)?.url
    if (!url) throw new Error('Faltan enlaces de subida.')
    let etag: string
    try {
      etag = await put(url, await readRange(full, (n - 1) * partSize, partSize))
    } catch (e) {
      if (/\(404\)/.test((e as Error).message)) await progress.clear(hash)
      throw e
    }
    done = [...done, { partNumber: n, etag }]
    await progress.save(hash, uploadId, done)
  }
  await api.call('POST', `${base}/complete`, { hash, size, uploadId, parts: done })
  await progress.clear(hash)
}

export async function download(
  api: CloudApi,
  orgId: string,
  hash: string,
  full: string
): Promise<void> {
  const { url } = await api.call<{ url: string }>('GET', `/files/${orgId}/blobs/${hash}`)
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => {
    throw new Error('No hay conexión con la nube de Alisuite.')
  })
  if (!res.ok || !res.body) throw new Error(`No se pudo descargar el archivo (${res.status}).`)
  await mkdir(dirname(full), { recursive: true })
  const temp = `${full}${TEMP_SUFFIX}`
  const digest = createHash('sha256')
  const source = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
  source.on('data', (chunk: Buffer) => digest.update(chunk))
  try {
    await pipeline(source, createWriteStream(temp))
    if (digest.digest('hex') !== hash)
      throw new Error('El archivo llegó dañado. Se volverá a intentar.')
    await rename(temp, full)
  } catch (e) {
    await rm(temp, { force: true })
    throw e
  }
}
