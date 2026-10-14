import { useEffect, useState } from 'react'
import type { FilesStatus } from '@shared/files'

export const filesApi = window.api.files

const OFF: FilesStatus = { active: false, queued: 0, files: {}, error: null, recordings: false }

export function useFilesStatus(): FilesStatus {
  const [status, setStatus] = useState<FilesStatus>(OFF)
  useEffect(() => {
    let alive = true
    void filesApi.status().then((s) => alive && setStatus(s))
    const off = filesApi.onStatus(setStatus)
    return () => {
      alive = false
      off()
    }
  }, [])
  return status
}

export const VAULT_PREFIX = 'Workspace/'
