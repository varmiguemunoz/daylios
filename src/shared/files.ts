export const PART_SIZE = 8 * 1024 * 1024
export const MULTIPART_THRESHOLD = PART_SIZE
export const SHA256 = /^[0-9a-f]{64}$/
export const FILES_TABLE = 'file_manifest'
export const TRASH_DAYS = 30

export interface UploadRequest {
  hash: string
  size: number
}

export type UploadPlan =
  | { mode: 'exists' }
  | { mode: 'single'; url: string }
  | { mode: 'multipart'; uploadId: string; partSize: number; parts: PartUrl[] }

export interface PartUrl {
  partNumber: number
  url: string
}

export interface PartUrlsRequest {
  hash: string
  uploadId: string
  partNumbers: number[]
}

export interface CompleteUploadRequest {
  hash: string
  size: number
  uploadId?: string
  parts?: { partNumber: number; etag: string }[]
}

export interface DownloadResponse {
  url: string
}

export interface UsageResponse {
  bytes: number
  limitBytes: number
  maxFileBytes: number
}

export type FileSyncState = 'synced' | 'uploading' | 'downloading' | 'error' | 'conflict'

export interface FilesStatus {
  active: boolean
  queued: number
  files: Record<string, FileSyncState>
  error: string | null
  recordings: boolean
}

export interface TrashedFile {
  id: string
  path: string
  deletedAt: string
}

export interface FilesApi {
  status(): Promise<FilesStatus>
  usage(): Promise<UsageResponse | null>
  setRecordings(on: boolean): Promise<FilesStatus>
  syncNow(): Promise<FilesStatus>
  trash(): Promise<TrashedFile[]>
  onStatus(cb: (status: FilesStatus) => void): () => void
}

export const RECORDING_EXTENSIONS = ['.webm', '.m4a', '.mp4', '.mov', '.wav', '.mp3', '.aac']
const IGNORED_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini', 'Icon\r'])
export const TEMP_SUFFIX = '.daylios-part'

export function isIgnoredPath(relative: string, recordings: boolean): boolean {
  const parts = relative.split('/')
  if (parts.some((p) => p.startsWith('.') || IGNORED_NAMES.has(p))) return true
  const name = parts[parts.length - 1]
  if (name.startsWith('~$') || name.endsWith('.tmp') || name.endsWith(TEMP_SUFFIX)) return true
  if (!recordings && RECORDING_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)))
    return true
  return false
}

export function conflictName(relative: string, who: string, date: Date): string {
  const slash = relative.lastIndexOf('/')
  const dir = slash >= 0 ? relative.slice(0, slash + 1) : ''
  const name = relative.slice(slash + 1)
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  const day = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
    .format(date)
    .replace('.', '')
  return `${dir}${base} (conflicto de ${who.replace(/[/:]/g, '-')}, ${day})${ext}`
}

export const blobKey = (orgId: string, hash: string): string => `orgs/${orgId}/blobs/${hash}`
