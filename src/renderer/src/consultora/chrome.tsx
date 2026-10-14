import { createContext, useContext, useEffect } from 'react'
import type { Screen } from './lib'
import type { Section } from './sections'

/** Lo que las pantallas necesitan del marco de la ventana Consultora. */
export interface ConsultoraChrome {
  /** Ir a una sección de Consultora (reinicia la pila). */
  openSection: (id: Section) => void
  /** Reemplaza la pila entera (p. ej. al ir a la grabación). */
  reset: (screens: Screen[]) => void
  /** Nombre de lo abierto para la ruta de la franja («Clientes › Acme»). */
  setTitle: (title: string | null) => void
}

export const ChromeContext = createContext<ConsultoraChrome>({
  openSection: () => undefined,
  reset: () => undefined,
  setTitle: () => undefined
})

export const useChrome = (): ConsultoraChrome => useContext(ChromeContext)

/** La pantalla dice su nombre a la franja superior (cliente, contacto, reunión…). */
export function useScreenTitle(title: string | null | undefined): void {
  const { setTitle } = useChrome()
  useEffect(() => {
    setTitle(title ?? null)
  }, [title, setTitle])
}
