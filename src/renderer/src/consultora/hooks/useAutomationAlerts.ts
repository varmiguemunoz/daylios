import { useCallback } from 'react'
import { useLiveLoad } from './useLiveLoad'

export function useAutomationAlerts(): number {
  const load = useCallback(() => window.api.automations.list(), [])
  const { data } = useLiveLoad(load)
  return (data ?? []).filter((a) => a.counts.failedRecent > 0 || a.status === 'locked').length
}
