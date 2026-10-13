import { createContext, useContext } from 'react'
import type { CanvasNode } from '@shared/canvas'

/** Lo que los nodos necesitan del board (sin pasar props por React Flow). */
export interface BoardActions {
  /** Cambia campos del nodo de canvas (texto, color, forma…) y guarda en el historial. */
  patch: (id: string, change: Partial<CanvasNode>) => void
  /** Abre una ruta de la bóveda (nota incrustada, archivo). */
  openPath: (path: string) => void
  /** Carpeta del board en la bóveda: rutas relativas de imágenes en el texto. */
  base: string
  /** Nodo que debe entrar a escribir nada más aparecer (tarjeta nueva, grupo nuevo). */
  editingId: string | null
  setEditing: (id: string | null) => void
}

export const BoardContext = createContext<BoardActions>({
  patch: () => undefined,
  openPath: () => undefined,
  base: '',
  editingId: null,
  setEditing: () => undefined
})

export const useBoard = (): BoardActions => useContext(BoardContext)
