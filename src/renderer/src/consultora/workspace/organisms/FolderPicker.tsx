import { useEffect, useMemo, useState } from 'react'
import { Folder, Home } from 'lucide-react'
import type { FolderNode, WorkspaceItem } from '@shared/workspace'
import { normalizeName } from '@shared/consultora'
import { Modal, SearchField } from '../../../ui'
import { ws } from '../lib'

interface FolderPickerProps {
  item: WorkspaceItem
  onPick: (folderId: string | null) => void
  onClose: () => void
}

interface Flat {
  id: string | null
  name: string
  path: string
  depth: number
}

function flatten(nodes: FolderNode[], depth = 0, out: Flat[] = []): Flat[] {
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name, path: n.path, depth })
    flatten(n.children, depth + 1, out)
  }
  return out
}

export function FolderPicker({ item, onPick, onClose }: FolderPickerProps): React.JSX.Element {
  const [tree, setTree] = useState<FolderNode[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    ws.tree()
      .then(setTree)
      .catch(() => setTree([]))
  }, [])

  const q = normalizeName(query)
  const options = useMemo(() => {
    const all: Flat[] = [{ id: null, name: 'Workspace', path: '', depth: 0 }, ...flatten(tree, 1)]
    return all.filter((f) => {
      if (
        item.kind === 'folder' &&
        f.id &&
        (f.path === item.path || f.path.startsWith(`${item.path}/`))
      )
        return false
      return !q || normalizeName(f.path || f.name).includes(q)
    })
  }, [tree, q, item])

  return (
    <Modal open title={`Mover «${item.name}» a…`} onClose={onClose} size="sm">
      <div className="flex flex-col gap-3">
        <div className="flex">
          <SearchField
            value={query}
            onChange={setQuery}
            autoFocus
            placeholder="Buscar carpeta"
            label="Buscar carpeta"
          />
        </div>
        <ul className="scroll-area max-h-[50vh] overflow-y-auto rounded-[6px] border border-ob-border bg-ob-bg py-1">
          {options.map((f) => {
            const current = f.id === item.parentId
            const Icon = f.id ? Folder : Home
            return (
              <li key={f.id ?? 'root'}>
                <button
                  type="button"
                  disabled={current}
                  onClick={() => onPick(f.id)}
                  style={{ paddingLeft: 16 + (q ? 0 : f.depth * 16) }}
                  className="flex h-8 w-full items-center gap-2.5 pr-4 text-left text-list transition-colors hover:bg-ob-hover disabled:text-ob-faint disabled:hover:bg-transparent"
                >
                  <Icon
                    size={15}

                    className="shrink-0 text-ob-muted"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{q && f.path ? f.path : f.name}</span>
                  {current && <span className="shrink-0 text-micro font-medium">Aquí está</span>}
                </button>
              </li>
            )
          })}
          {options.length === 0 && (
            <li className="px-4 py-3 text-caption text-ob-muted">Ninguna carpeta coincide.</li>
          )}
        </ul>
      </div>
    </Modal>
  )
}
