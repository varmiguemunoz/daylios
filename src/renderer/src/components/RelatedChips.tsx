import { Briefcase, FileText } from 'lucide-react'
import type { NoteBrief } from '@shared/notes'

interface RelatedChipsProps {
  notes: NoteBrief[]
  clients: { id: string; name: string }[]
  onOpenNote: (id: string) => void
  onOpenClient?: (id: string) => void
}

export function RelatedChips({
  notes,
  clients,
  onOpenNote,
  onOpenClient
}: RelatedChipsProps): React.JSX.Element | null {
  if (!notes.length && !clients.length) return null
  const chip =
    'ui-chip inline-flex h-7 max-w-56 items-center gap-1.5 truncate rounded-full bg-surface px-3 text-micro font-bold text-milk-soft transition-colors hover:bg-surface-raised hover:text-milk'
  return (
    <nav aria-label="Relacionadas" className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-caption text-milk-soft">Relacionadas:</span>
      {clients.map((c) => (
        <button
          key={c.id}
          type="button"
          className={chip}
          onClick={() => onOpenClient?.(c.id)}
          title={`Cliente ${c.name}`}
        >
          <Briefcase size={12} strokeWidth={2.5} className="shrink-0" aria-hidden />
          <span className="truncate">{c.name}</span>
        </button>
      ))}
      {notes.map((n) => (
        <button
          key={n.id}
          type="button"
          className={chip}
          onClick={() => onOpenNote(n.id)}
          title={n.title}
        >
          <FileText size={12} strokeWidth={2.5} className="shrink-0" aria-hidden />
          <span className="truncate">{n.title}</span>
        </button>
      ))}
    </nav>
  )
}
