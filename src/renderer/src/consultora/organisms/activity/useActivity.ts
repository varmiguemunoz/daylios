import { useCallback, useEffect, useState } from 'react'
import type { ActivityEntry, ActivityFilter, ActivityState } from '@shared/activity'

export const activityApi = window.api.activity

const INITIAL: ActivityState = { enabled: false, unseen: 0 }

export function useActivityState(): ActivityState {
  const [state, setState] = useState<ActivityState>(INITIAL)
  useEffect(() => {
    let alive = true
    void activityApi.state().then((s) => alive && setState(s))
    const off = activityApi.onChanged(setState)
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}

export function useActivityList(filter: ActivityFilter): ActivityEntry[] {
  const [items, setItems] = useState<ActivityEntry[]>([])
  const { actorId, verb, entity, entityId, limit } = filter
  const load = useCallback(
    () => activityApi.list({ actorId, verb, entity, entityId, limit }),
    [actorId, verb, entity, entityId, limit]
  )
  useEffect(() => {
    let alive = true
    const run = (): void => {
      void load().then((list) => alive && setItems(list))
    }
    run()
    const off = activityApi.onChanged(run)
    return () => {
      alive = false
      off()
    }
  }, [load])
  return items
}
