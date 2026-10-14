import { useEffect, useState } from 'react'
import { todayKey, type DayKey } from '@shared/tasks'
import { onWindowShown } from './api'

export function useToday(): DayKey {
  const [today, setToday] = useState(todayKey)

  useEffect(() => {
    const sync = (): void => setToday(todayKey())
    const timer = window.setInterval(sync, 60_000)
    const off = onWindowShown(sync)
    return () => {
      window.clearInterval(timer)
      off()
    }
  }, [])

  return today
}
