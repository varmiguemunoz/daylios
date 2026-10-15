import { useCallback, useEffect, useState } from 'react'
import {
  canInsert,
  canMove,
  insert,
  move,
  newNode,
  parentSlot,
  sameSlot,
  nodeAllowed,
  nodeSpec,
  type Definition,
  type MoveMode,
  type NodeType,
  type Slot
} from '@shared/automations'

export const NODE_DRAG = 'application/x-daylios-automation-node'
export const CATALOG_DRAG = 'application/x-daylios-automation-catalog'

export type DragItem = { kind: 'move'; id: string } | { kind: 'new'; type: NodeType }

export interface TreeDrag {
  item: DragItem | null
  mode: MoveMode
  start: (item: DragItem, e: React.DragEvent) => void
  end: () => void
  reason: (slot: Slot) => string | null
  drop: (
    slot: Slot,
    apply: (change: (d: Definition) => Definition) => string | null
  ) => string | null
  track: (e: React.DragEvent) => void
}

export function useTreeDrag(def: Definition): TreeDrag {
  const [item, setItem] = useState<DragItem | null>(null)
  const [mode, setMode] = useState<MoveMode>('node')

  useEffect(() => {
    if (!item) return
    const key = (e: KeyboardEvent): void => setMode(e.altKey ? 'subtree' : 'node')
    window.addEventListener('keydown', key)
    window.addEventListener('keyup', key)
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('keyup', key)
    }
  }, [item])

  const start = useCallback((next: DragItem, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = next.kind === 'move' ? 'move' : 'copy'
    e.dataTransfer.setData(
      next.kind === 'move' ? NODE_DRAG : CATALOG_DRAG,
      next.kind === 'move' ? next.id : next.type
    )
    setMode(e.altKey ? 'subtree' : 'node')
    setItem(next)
  }, [])

  const end = useCallback(() => setItem(null), [])

  const track = useCallback((e: React.DragEvent) => setMode(e.altKey ? 'subtree' : 'node'), [])

  const reason = useCallback(
    (slot: Slot): string | null => {
      if (!item) return 'Nada que soltar.'
      if (item.kind === 'move') {
        const from = parentSlot(def, item.id)
        if ((from && sameSlot(from, slot)) || (slot.parent === item.id && mode === 'node'))
          return 'Ya está aquí.'
        return canMove(def, item.id, slot, mode)
      }
      const spec = nodeSpec(item.type)
      if (!spec || !nodeAllowed(spec, def.subject)) return 'Este paso no aplica a este sujeto.'
      return canInsert(def, slot, newNode(item.type))
    },
    [def, item, mode]
  )

  const drop = useCallback(
    (
      slot: Slot,
      apply: (change: (d: Definition) => Definition) => string | null
    ): string | null => {
      const current = item
      setItem(null)
      if (!current) return null
      if (current.kind === 'move') return apply((d) => move(d, current.id, slot, mode))
      return apply((d) => insert(d, slot, newNode(current.type)))
    },
    [item, mode]
  )

  return { item, mode, start, end, reason, drop, track }
}
