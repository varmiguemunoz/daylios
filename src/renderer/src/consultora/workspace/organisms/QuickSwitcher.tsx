import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FilePlus2 } from 'lucide-react'
import { normalizeName } from '@shared/consultora'
import type { SearchHit, WorkspaceItem } from '@shared/workspace'
import { useOverlay } from '../../../ui/organisms/overlay'
import { KIND_ICON, flattenExplorer, openItem, ws } from '../lib'
import { useWorkspace } from '../context'

/** Coincidencia difusa: las letras de la búsqueda aparecen en orden. Más puntos si van seguidas. */
function score(text: string, query: string): number {
  const t = normalizeName(text)
  if (t.includes(query)) return 1000 - t.indexOf(query)
  let at = -1
  let points = 0
  for (const ch of query) {
    const next = t.indexOf(ch, at + 1)
    if (next < 0) return -1
    points += next === at + 1 ? 3 : 1
    at = next
  }
  return points
}

interface Result {
  item: WorkspaceItem
  hint: string
}

/** Selector rápido (⌘O), como el de Obsidian: escribir, flechas y Enter. Si no existe, crea la nota. */
export function QuickSwitcher({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { go, folderId, setError } = useWorkspace()
  const panel = useRef<HTMLDivElement>(null)
  const [all, setAll] = useState<WorkspaceItem[]>([])
  const [hits, setHits] = useState<SearchHit[]>([])
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  useOverlay(true, onClose, panel)

  useEffect(() => {
    ws.explorer()
      .then((t) => setAll(flattenExplorer(t)))
      .catch(() => setAll([]))
  }, [])

  const q = normalizeName(query)
  // Texto dentro de las notas: solo con 3 letras o más (es más lento y menos preciso).
  useEffect(() => {
    if (q.length < 3) return
    const t = setTimeout(() => {
      ws.search(q)
        .then(setHits)
        .catch(() => setHits([]))
    }, 120)
    return () => clearTimeout(t)
  }, [q])

  const results = useMemo<Result[]>(() => {
    if (!q) {
      return [...all]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 12)
        .map((item) => ({ item, hint: item.path }))
    }
    const byName = all
      .map((item) => ({ item, s: Math.max(score(item.name, q), score(item.path, q) - 5) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map(({ item }) => ({ item, hint: item.path }))
    const seen = new Set(byName.map((r) => r.item.id))
    const byText = (q.length >= 3 ? hits : [])
      .filter((h) => !seen.has(h.item.id) && h.snippet)
      .slice(0, 6)
      .map((h) => ({ item: h.item, hint: h.snippet }))
    return [...byName, ...byText]
  }, [all, hits, q])

  const exact = results.some((r) => normalizeName(r.item.name) === q)
  const canCreate = Boolean(query.trim()) && !exact
  const total = results.length + (canCreate ? 1 : 0)
  const current = Math.min(index, Math.max(0, total - 1))

  const choose = async (i: number): Promise<void> => {
    if (i < results.length) {
      onClose()
      openItem(results[i].item, go)
      return
    }
    try {
      const name = query.trim()
      const item = await ws.createNote(folderId, name, `# ${name}\n\n`)
      onClose()
      openItem(item, go)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/40 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-label="Abrir archivo"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-fit max-h-[70vh] w-[min(600px,calc(100vw-48px))] flex-col overflow-hidden rounded-[8px] border border-ob-border bg-ob-alt font-ob text-ob-text shadow-[0_16px_48px_-12px_rgb(0_0_0/0.8)] outline-none"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((current + 1) % Math.max(1, total))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((current - 1 + total) % Math.max(1, total))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (total) void choose(e.shiftKey && canCreate ? results.length : current)
            }
          }}
          placeholder="Busca un archivo…"
          aria-label="Busca un archivo"
          className="h-12 shrink-0 border-b border-ob-border bg-transparent px-4 text-[15px] outline-none placeholder:text-ob-faint"
        />
        <ul role="listbox" aria-label="Resultados" className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {results.map((r, i) => {
            const Icon = KIND_ICON[r.item.kind]
            return (
              <li key={r.item.id} role="option" aria-selected={i === current}>
                <button
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => void choose(i)}
                  className={`flex w-full items-start gap-2.5 rounded-[4px] px-3 py-1.5 text-left ${
                    i === current ? 'bg-ob-active' : ''
                  }`}
                >
                  <Icon
                    size={14}
                    strokeWidth={2}
                    className="mt-[3px] shrink-0 text-ob-faint"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-ob-text">{r.item.name}</span>
                    <span className="block truncate text-[12px] text-ob-faint">{r.hint}</span>
                  </span>
                </button>
              </li>
            )
          })}
          {canCreate && (
            <li role="option" aria-selected={current === results.length}>
              <button
                type="button"
                onMouseEnter={() => setIndex(results.length)}
                onClick={() => void choose(results.length)}
                className={`flex w-full items-center gap-2.5 rounded-[4px] px-3 py-2 text-left text-[14px] ${
                  current === results.length ? 'bg-ob-active text-ob-text' : 'text-ob-muted'
                }`}
              >
                <FilePlus2 size={14} className="shrink-0 text-ob-accent" aria-hidden />
                Crear nota «{query.trim()}»
              </button>
            </li>
          )}
          {!total && (
            <li className="px-3 py-3 text-[13px] text-ob-faint">No hay archivos todavía.</li>
          )}
        </ul>
        <p className="flex shrink-0 gap-4 border-t border-ob-border px-4 py-2 text-[11px] text-ob-faint">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>⇧↵ crear</span>
          <span>esc cerrar</span>
        </p>
      </div>
    </div>,
    document.body
  )
}
