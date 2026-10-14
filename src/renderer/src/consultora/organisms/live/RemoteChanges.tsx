import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const FRESH_MS = 1500

const FreshContext = createContext<ReadonlySet<string>>(new Set())

const keyOf = (entity: string, id: string): string => `${entity}\u0001${id}`

export function RemoteChangesProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const off = window.api.onRemoteChanges((changes) => {
      const keys = changes.flatMap((c) => c.ids.map((id) => keyOf(c.entity, id)))
      if (!keys.length) return
      setFresh((prev) => new Set([...prev, ...keys]))
      const timer = setTimeout(() => {
        timers.delete(timer)
        setFresh((prev) => {
          const next = new Set(prev)
          for (const k of keys) next.delete(k)
          return next
        })
      }, FRESH_MS)
      timers.add(timer)
    })
    return () => {
      off()
      for (const t of timers) clearTimeout(t)
    }
  }, [])

  return <FreshContext.Provider value={fresh}>{children}</FreshContext.Provider>
}

export function useFresh(entity: string): (id: string) => boolean {
  const fresh = useContext(FreshContext)
  return (id) => fresh.has(keyOf(entity, id))
}

export const freshClass = (on: boolean): string => (on ? 'ob-fresh' : '')
