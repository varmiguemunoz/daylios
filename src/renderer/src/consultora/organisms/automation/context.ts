import { createContext, useContext } from 'react'
import type {
  AutomationOptions,
  Definition,
  Fragment,
  Names,
  NodeStats,
  Slot
} from '@shared/automations'
import type { TreeDrag } from '../../hooks/useTreeDrag'

export type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'trigger'; id: string }
  | { kind: 'slot'; slot: Slot }
  | { kind: 'add-trigger' }

export interface Editor {
  def: Definition
  apply: (change: (def: Definition) => Definition) => string | null
  options: AutomationOptions | null
  names: Names
  issues: Record<string, string[]>
  selection: Selection | null
  select: (selection: Selection | null) => void
  drag: TreeDrag
  stats: NodeStats | null
  path: Set<string> | null
  clipboard: Fragment | null
  setClipboard: (fragment: Fragment | null) => void
  notify: (message: string | null) => void
}

export const EditorContext = createContext<Editor | null>(null)

export function useEditor(): Editor {
  const editor = useContext(EditorContext)
  if (!editor) throw new Error('useEditor fuera del editor de automatizaciones')
  return editor
}

export function namesFrom(options: AutomationOptions | null, def: Definition): Names {
  const find = (list: { id: string; name: string }[] | undefined, id: string): string | undefined =>
    list?.find((x) => x.id === id)?.name
  return (kind, id) => {
    if (kind === 'node') return def.nodes[id]?.name
    if (kind === 'tag') return find(options?.tags, id) ?? id
    if (kind === 'pipeline') return find(options?.pipelines, id)
    if (kind === 'stage') return find(options?.stages, id)
    if (kind === 'client') return find(options?.clients, id)
    return find(options?.projects, id)
  }
}
