import { useState, type DragEvent } from 'react'

/**
 * Arrastrar para reordenar, con el drag and drop nativo del navegador (sin librería).
 *
 * - `item(id, index, group)` va en cada elemento arrastrable.
 * - `zone(group, count)` va en la lista que lo contiene (recibe el «soltar»).
 * - `target` dice dónde caería: la lista pinta una línea en ese índice.
 * - Al soltar llama `onMove(id, index, group)`; `index` cuenta el elemento arrastrado
 *   en su sitio original: usa `finalIndex()` si se mueve dentro de la misma lista.
 *
 * `group` permite varias listas (columnas del pipeline). Con una sola lista, usa cualquier texto fijo.
 */
export function useReorder(onMove: (id: string, index: number, group: string) => void): {
  dragging: string | null
  target: { group: string; index: number } | null
  item: (id: string, index: number, group: string) => React.HTMLAttributes<HTMLElement> & { draggable: boolean }
  zone: (group: string, count: number) => React.HTMLAttributes<HTMLElement>
} {
  const [dragging, setDragging] = useState<string | null>(null)
  const [target, setTarget] = useState<{ group: string; index: number } | null>(null)

  const reset = (): void => {
    setDragging(null)
    setTarget(null)
  }

  return {
    dragging,
    target,
    item: (id, index, group) => ({
      draggable: true,
      onDragStart: (e: DragEvent<HTMLElement>) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', id)
        setDragging(id)
      },
      onDragEnd: reset,
      onDragOver: (e: DragEvent<HTMLElement>) => {
        if (!dragging) return
        e.preventDefault()
        // Mitad superior = antes de este elemento; mitad inferior = después
        const box = e.currentTarget.getBoundingClientRect()
        const after = e.clientY > box.top + box.height / 2
        setTarget({ group, index: index + (after ? 1 : 0) })
      }
    }),
    zone: (group, count) => ({
      onDragOver: (e: DragEvent<HTMLElement>) => {
        if (!dragging) return
        e.preventDefault()
        // Sobre el hueco vacío de la lista (no sobre un elemento): al final
        if (e.target === e.currentTarget) setTarget({ group, index: count })
      },
      onDrop: (e: DragEvent<HTMLElement>) => {
        if (!dragging || !target) return
        e.preventDefault()
        onMove(dragging, target.index, target.group)
        reset()
      }
    })
  }
}

/** Índice final dentro de la misma lista: al quitar el elemento, lo que hay detrás sube uno. */
export const finalIndex = (index: number, from: number): number => (index > from ? index - 1 : index)
