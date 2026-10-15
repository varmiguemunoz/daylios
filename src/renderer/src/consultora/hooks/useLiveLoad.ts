import { useEffect } from 'react'
import { useLoad } from '../lib'

export function useLiveLoad<T>(load: () => Promise<T>): ReturnType<typeof useLoad<T>> {
  const state = useLoad(load)
  const { reload } = state
  useEffect(() => window.api.automations.onChanged(() => void reload()), [reload])
  return state
}
