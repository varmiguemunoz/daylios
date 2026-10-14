import { useEffect, useMemo, useState } from 'react'
import { FilePlus2 } from 'lucide-react'
import { normalizeName } from '@shared/consultora'
import type { SearchHit, WorkspaceItem } from '@shared/workspace'
import { SwitcherFrame, type SwitcherOption } from '../../shell/SwitcherFrame'
import { KIND_ICON, flattenExplorer, fuzzyScore, openItem, ws } from '../lib'
import { useWorkspace } from '../context'

interface Result {
  item: WorkspaceItem
  hint: string
}

export function QuickSwitcher({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { go, folderId, setError } = useWorkspace()
  const [all, setAll] = useState<WorkspaceItem[]>([])
  const [hits, setHits] = useState<SearchHit[]>([])
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

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
      .map((item) => ({
        item,
        s: Math.max(fuzzyScore(item.name, q), fuzzyScore(item.path, q) - 5)
      }))
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

  const options: SwitcherOption[] = [
    ...results.map((r) => {
      const Icon = KIND_ICON[r.item.kind]
      return {
        key: r.item.id,
        icon: <Icon size={14} strokeWidth={2} />,
        title: r.item.name,
        hint: r.hint
      }
    }),
    ...(canCreate
      ? [
          {
            key: '__create',
            icon: <FilePlus2 size={14} className="text-ob-accent" />,
            title: `Crear nota «${query.trim()}»`,
            action: true
          }
        ]
      : [])
  ]

  return (
    <SwitcherFrame
      label="Abrir archivo"
      placeholder="Busca un archivo…"
      query={query}
      onQuery={setQuery}
      options={options}
      index={current}
      onIndex={setIndex}
      onChoose={(i, alt) => void choose(alt && canCreate ? results.length : i)}
      empty="No hay archivos todavía."
      hints={['↑↓ navegar', '↵ abrir', '⇧↵ crear', 'esc cerrar']}
      onClose={onClose}
    />
  )
}
