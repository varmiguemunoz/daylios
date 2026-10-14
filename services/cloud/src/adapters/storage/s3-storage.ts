import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { ObjectStorage } from '../../ports'

export interface S3Config {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

const UPLOAD_TTL_S = 3600
const DOWNLOAD_TTL_S = 600

export class S3Storage implements ObjectStorage {
  private readonly client: S3Client

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: true
    })
  }

  presignPut(key: string, size: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.config.bucket, Key: key, ContentLength: size }),
      { expiresIn: UPLOAD_TTL_S }
    )
  }

  async createMultipart(key: string): Promise<string> {
    const res = await this.client.send(
      new CreateMultipartUploadCommand({ Bucket: this.config.bucket, Key: key })
    )
    if (!res.UploadId) throw new Error('El almacén no abrió la subida por partes.')
    return res.UploadId
  }

  presignPart(key: string, uploadId: string, partNumber: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new UploadPartCommand({
        Bucket: this.config.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber
      }),
      { expiresIn: UPLOAD_TTL_S }
    )
  }

  async completeMultipart(
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[]
  ): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [...parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag }))
        }
      })
    )
  }

  presignGet(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      {
        expiresIn: DOWNLOAD_TTL_S
      }
    )
  }

  async size(key: string): Promise<number | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key })
      )
      return res.ContentLength ?? null
    } catch {
      return null
    }
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }))
  }
}
