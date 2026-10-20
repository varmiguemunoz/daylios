import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardPaste, Star } from 'lucide-react'
import { normalizeName } from '@shared/consultora'
import {
  NODE_GROUPS,
  ACTIVE_NODES,
  nodeAllowed,
  SUBJECT_LABELS,
  TRIGGERS,
  triggerAllowed,
  type NodeType,
  type SubjectType
} from '@shared/automations'
import { SearchField } from '../../../ui'
import { useUiState } from '../../../lib/ui-state'
import { NodeIcon } from '../../atoms/NodeIcon'
import { SidePanel } from './SidePanel'

interface Entry {
  type: string
  group: string
  label: string
  description: string
  icon: string
  reason: string | null
}

const TRIGGER_GROUPS = [
  { id: 'contacto', label: 'Contacto' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'productividad', label: 'Productividad' },
  { id: 'tiempo', label: 'Tiempo' }
]

function entriesFor(mode: 'node' | 'trigger', subject: SubjectType): Entry[] {
  const other = (s: string): string =>
    `Es para ${SUBJECT_LABELS[s as SubjectType]?.toLowerCase() ?? s}.`
  if (mode === 'trigger')
    return TRIGGERS.map((t) => ({
      type: t.type,
      group: t.group,
      label: t.label,
      description: t.description,
      icon: t.icon,
      reason: triggerAllowed(t, subject) ? null : other(String(t.subject))
    }))
  return ACTIVE_NODES.map((n) => ({
    type: n.type,
    group: n.group,
    label: n.label,
    description: n.description,
    icon: n.icon,
    reason: nodeAllowed(n, subject)
      ? null
      : `Solo para ${(n.subjects as SubjectType[]).map((s) => SUBJECT_LABELS[s].toLowerCase()).join(' o ')}.`
  }))
}

export function NodePicker({
  mode,
  subject,
  onPick,
  onPaste,
  onDragStart,
  onDragEnd,
  onClose
}: {
  mode: 'node' | 'trigger'
  subject: SubjectType
  onPick: (type: string) => void
  onPaste?: () => void
  onDragStart?: (type: NodeType, e: React.DragEvent) => void
  onDragEnd?: () => void
  onClose: () => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [favorites, setFavorites] = useUiState<string[]>(
    `automations.favorites.${mode}`,
    [],
    Array.isArray
  )
  const [closed, setClosed] = useUiState<string[]>(
    `automations.closedGroups.${mode}`,
    [],
    Array.isArray
  )
  const entries = useMemo(() => entriesFor(mode, subject), [mode, subject])
  const q = normalizeName(query)
  const shown = entries.filter(
    (e) => !q || normalizeName(`${e.label} ${e.description}`).includes(q)
  )
  const groups = [
    { id: '__fav', label: 'Favoritos' },
    ...(mode === 'trigger' ? TRIGGER_GROUPS : NODE_GROUPS)
  ]
  const toggle = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id]

  const row = (e: Entry): React.JSX.Element => {
    const fav = favorites.includes(e.type)
    return (
      <li key={e.type} className="group flex items-start gap-1">
        <button
          type="button"
          disabled={e.reason !== null}
          draggable={mode === 'node' && e.reason === null && Boolean(onDragStart)}
          onDragStart={(ev) => onDragStart?.(e.type as NodeType, ev)}
          onDragEnd={onDragEnd}
          onClick={() => onPick(e.type)}
          title={e.reason ?? e.description}
          className="flex min-w-0 flex-1 items-start gap-2.5 rounded-[4px] px-2 py-1.5 text-left transition-colors hover:bg-ob-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[4px] bg-ob-active text-ob-link">
            <NodeIcon name={e.icon} size={14} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-ob-text">{e.label}</span>
            <span className="block text-[12px] leading-snug text-ob-muted">
              {e.reason ?? e.description}
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-label={fav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          aria-pressed={fav}
          onClick={() => setFavorites(toggle(favorites, e.type))}
          className={`mt-1 grid size-7 shrink-0 place-items-center rounded-[4px] hover:bg-ob-active ${
            fav
              ? 'text-ob-yellow'
              : 'text-ob-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
          }`}
        >
          <Star size={13} aria-hidden fill={fav ? 'currentColor' : 'none'} />
        </button>
      </li>
    )
  }

  return (
    <SidePanel title={mode === 'trigger' ? 'Añadir trigger' : 'Añadir paso'} onClose={onClose}>
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Buscar por nombre o descripción"
        autoFocus
      />
      {onPaste && (
        <button
          type="button"
          onClick={onPaste}
          className="mt-3 flex h-8 w-full items-center gap-2 rounded-[4px] bg-ob-accent/15 px-2.5 text-[13px] font-medium text-ob-link hover:bg-ob-accent/25"
        >
          <ClipboardPaste size={14} aria-hidden />
          Pegar lo copiado aquí
        </button>
      )}
      {mode === 'node' && (
        <p className="mt-3 text-[12px] text-ob-faint">
          Haz clic o arrastra un paso a cualquier «+» del lienzo.
        </p>
      )}
      <div className="mt-2 flex flex-col">
        {groups.map((g) => {
          const items =
            g.id === '__fav'
              ? shown.filter((e) => favorites.includes(e.type))
              : shown.filter((e) => e.group === g.id)
          if (!items.length) return null
          const open = Boolean(q) || !closed.includes(g.id)
          return (
            <section key={g.id} className="mt-2">
              <button
                type="button"
                onClick={() => setClosed(toggle(closed, g.id))}
                aria-expanded={open}
                className="flex h-7 w-full items-center gap-1 px-1 text-[12px] font-semibold text-ob-faint hover:text-ob-muted"
              >
                {open ? (
                  <ChevronDown size={13} aria-hidden />
                ) : (
                  <ChevronRight size={13} aria-hidden />
                )}
                {g.label}
                <span className="font-normal">· {items.length}</span>
              </button>
              {open && <ul className="flex flex-col">{items.map(row)}</ul>}
            </section>
          )
        })}
        {!shown.length && (
          <p className="px-2 py-6 text-center text-[13px] text-ob-faint">
            Nada coincide con «{query}».
          </p>
        )}
      </div>
    </SidePanel>
  )
}
