import { useEffect, useMemo, useState } from 'react'
import { Briefcase, CalendarClock, FolderKanban, Search, SquareKanban, User } from 'lucide-react'
import { normalizeName, type SearchHit } from '@shared/consultora'
import type { WorkspaceItem } from '@shared/workspace'
import { api, type Go, type Screen } from '../lib'
import { KIND_ICON, flattenExplorer, fuzzyScore, openItem, ws } from '../workspace/lib'
import { SwitcherFrame, type SwitcherOption } from './SwitcherFrame'

const TYPE: Record<SearchHit['type'], { label: string; Icon: typeof User }> = {
  client: { label: 'Cliente', Icon: Briefcase },
  project: { label: 'Proyecto', Icon: FolderKanban },
  meeting: { label: 'Reunión', Icon: CalendarClock },
  prospect: { label: 'Prospecto', Icon: SquareKanban },
  contact: { label: 'Contacto', Icon: User }
}

type Choice =
  { kind: 'hit'; hit: SearchHit } | { kind: 'item'; item: WorkspaceItem } | { kind: 'all' }

/**
 * Buscador global (⌘K), como el selector rápido de Obsidian: clientes, proyectos, reuniones,
 * prospectos y contactos, más los archivos de la bóveda por nombre. «Ver todos» abre los resultados.
 */
export function GlobalSwitcher({
  go,
  onClose
}: {
  go: Go
  onClose: () => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [files, setFiles] = useState<WorkspaceItem[]>([])
  const q = normalizeName(query)

  useEffect(() => {
    ws.explorer()
      .then((t) => setFiles(flattenExplorer(t)))
      .catch(() => setFiles([]))
  }, [])

  useEffect(() => {
    if (q.length < 2) return
    const t = setTimeout(() => {
      api
        .search(query.trim())
        .then(setHits)
        .catch(() => setHits([]))
    }, 150)
    return () => clearTimeout(t)
  }, [q, query])

  const choices = useMemo<Choice[]>(() => {
    if (q.length < 2) return []
    const found: Choice[] = hits.slice(0, 8).map((hit) => ({ kind: 'hit', hit }))
    const byName = files
      .map((item) => ({ item, s: fuzzyScore(item.name, q) }))
      .filter((r) => r.s >= 0 && r.item.kind !== 'folder')
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map(({ item }): Choice => ({ kind: 'item', item }))
    return [...found, ...byName, { kind: 'all' }]
  }, [hits, files, q])

  const options: SwitcherOption[] = choices.map((c, i) => {
    const first = (kind: Choice['kind']): string | undefined =>
      choices.findIndex((x) => x.kind === kind) === i
        ? kind === 'hit'
          ? 'Consultora'
          : 'Archivos'
        : undefined
    if (c.kind === 'hit') {
      const { label, Icon } = TYPE[c.hit.type]
      return {
        key: `${c.hit.type}-${c.hit.id}`,
        icon: <Icon size={14} />,
        title: c.hit.title,
        hint: c.hit.snippet ? `${label} · ${c.hit.snippet}` : label,
        group: first('hit')
      }
    }
    if (c.kind === 'item') {
      const Icon = KIND_ICON[c.item.kind]
      return {
        key: c.item.id,
        icon: <Icon size={14} />,
        title: c.item.name,
        hint: c.item.path,
        group: first('item')
      }
    }
    return {
      key: '__all',
      icon: <Search size={14} />,
      title: `Ver todos los resultados de «${query.trim()}»`,
      action: true
    }
  })

  const choose = (i: number, alt: boolean): void => {
    const c = alt ? ({ kind: 'all' } as Choice) : choices[i]
    if (!c) return
    onClose()
    if (c.kind === 'hit') go({ name: c.hit.type, id: c.hit.id } as Screen)
    else if (c.kind === 'item') openItem(c.item, go)
    else go({ name: 'search', query: query.trim() })
  }

  return (
    <SwitcherFrame
      label="Buscar en todo"
      placeholder="Busca clientes, contactos, reuniones o archivos…"
      query={query}
      onQuery={setQuery}
      options={options}
      index={index}
      onIndex={setIndex}
      onChoose={choose}
      empty={q.length < 2 ? 'Escribe al menos 2 letras.' : 'Sin resultados.'}
      hints={['↑↓ navegar', '↵ abrir', '⌘↵ ver todos', 'esc cerrar']}
      onClose={onClose}
    />
  )
}
