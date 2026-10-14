import { createHash, randomBytes } from 'crypto'
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand
} from '@aws-sdk/client-s3'

const env = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`Falta ${key}`)
  return value
}

const client = new S3Client({
  region: process.env.S3_REGION ?? 'auto',
  endpoint: env('S3_ENDPOINT'),
  credentials: {
    accessKeyId: env('S3_ACCESS_KEY_ID'),
    secretAccessKey: env('S3_SECRET_ACCESS_KEY')
  },
  forcePathStyle: true
})
const bucket = env('S3_BUCKET')
const prefix = `bench/${Date.now()}`
const sha = (data: Buffer): string => createHash('sha256').update(data).digest('hex')

async function read(key: string): Promise<Buffer> {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  return Buffer.from(
    await (res.Body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray()
  )
}

async function small(count: number): Promise<{ ms: number; failures: number }> {
  const start = Date.now()
  let failures = 0
  const files = Array.from({ length: count }, (_, i) => ({
    key: `${prefix}/small-${i}`,
    data: randomBytes(2048)
  }))
  for (let i = 0; i < files.length; i += 20) {
    await Promise.all(
      files.slice(i, i + 20).map(async (f) => {
        try {
          await client.send(new PutObjectCommand({ Bucket: bucket, Key: f.key, Body: f.data }))
          if (sha(await read(f.key)) !== sha(f.data)) failures++
        } catch {
          failures++
        }
      })
    )
  }
  return { ms: Date.now() - start, failures }
}

async function large(megabytes: number): Promise<{ ms: number; ok: boolean }> {
  const start = Date.now()
  const key = `${prefix}/large`
  const data = randomBytes(megabytes * 1024 * 1024)
  const partSize = 8 * 1024 * 1024
  const { UploadId } = await client.send(
    new CreateMultipartUploadCommand({ Bucket: bucket, Key: key })
  )
  const parts: { ETag?: string; PartNumber: number }[] = []
  for (let offset = 0, n = 1; offset < data.length; offset += partSize, n++) {
    const res = await client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId,
        PartNumber: n,
        Body: data.subarray(offset, offset + partSize)
      })
    )
    parts.push({ ETag: res.ETag, PartNumber: n })
  }
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId,
      MultipartUpload: { Parts: parts }
    })
  )
  return { ms: Date.now() - start, ok: sha(await read(key)) === sha(data) }
}

async function main(): Promise<void> {
  const a = await small(1000)
  console.log(`1000 archivos de 2 KB, subir y bajar: ${a.ms} ms, fallos ${a.failures}`)
  const b = await large(80)
  console.log(`80 MB por partes de 8 MB: ${b.ms} ms, hash ${b.ok ? 'correcto' : 'distinto'}`)
}

void main()
