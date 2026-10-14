import { useEffect, useState } from 'react'
import type { SyncStatus } from '@shared/sync-protocol'

export const syncApi = window.api.sync

const OFF: SyncStatus = {
  phase: 'off',
  pending: 0,
  lastPushAt: null,
  lastPullAt: null,
  error: null,
  bootstrap: null,
  deletedByOthers: []
}

export function useSync(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(OFF)
  useEffect(() => {
    let alive = true
    void syncApi.status().then((s) => alive && setStatus(s))
    const off = syncApi.onStatus(setStatus)
    return () => {
      alive = false
      off()
    }
  }, [])
  return status
}
