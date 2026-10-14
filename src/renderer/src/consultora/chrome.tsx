import { createContext, useContext, useEffect } from 'react'
import type { Screen } from './lib'
import type { Section } from './sections'

export interface ConsultoraChrome {
  openSection: (id: Section) => void

  reset: (screens: Screen[]) => void

  setTitle: (title: string | null) => void

  replaceWithRoot: () => void
}

export const ChromeContext = createContext<ConsultoraChrome>({
  openSection: () => undefined,
  reset: () => undefined,
  setTitle: () => undefined,
  replaceWithRoot: () => undefined
})

export const useChrome = (): ConsultoraChrome => useContext(ChromeContext)

export const ScrollKeyContext = createContext<string | null>(null)

export function useScreenTitle(title: string | null | undefined): void {
  const { setTitle } = useChrome()
  useEffect(() => {
    setTitle(title ?? null)
  }, [title, setTitle])
}

export function useGoneRedirect(error: string | null | undefined): void {
  const { replaceWithRoot } = useChrome()
  useEffect(() => {
    if (error && /no existe/i.test(error)) replaceWithRoot()
  }, [error, replaceWithRoot])
}
