import { createContext, useContext } from 'react'
import type { Screen } from './lib'
import type { Section } from './sections'

/** Lo que el workspace (sin cromo) necesita de la ventana Consultora. */
export interface ConsultoraChrome {
  /** Hay una grabación en curso (el workspace muestra «REC»). */
  recording: boolean
  /** Ir a una sección de Consultora (sale del workspace). */
  openSection: (id: Section) => void
  /** Reemplaza la pila entera (p. ej. al ir a la grabación). */
  reset: (screens: Screen[]) => void
}

export const ChromeContext = createContext<ConsultoraChrome>({
  recording: false,
  openSection: () => undefined,
  reset: () => undefined
})

export const useChrome = (): ConsultoraChrome => useContext(ChromeContext)
