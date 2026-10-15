import { useEffect, useRef } from 'react'

export function useSaveOnLeave(dirty: boolean, save: () => void): { discard: () => void } {
  const latest = useRef({ dirty, save, discarded: false })
  useEffect(() => {
    latest.current = { ...latest.current, dirty, save }
  })
  useEffect(
    () => () => {
      const { dirty: pending, save: commit, discarded } = latest.current
      if (pending && !discarded) commit()
    },
    []
  )
  return {
    discard: () => {
      latest.current.discarded = true
    }
  }
}
