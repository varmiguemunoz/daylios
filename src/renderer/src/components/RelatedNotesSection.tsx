import { Link2, X } from 'lucide-react'
import type { NoteBrief } from '@shared/notes'

interface RelatedNotesSectionProps {
  notes: NoteBrief[]
  onOpen: (id: string) => void
  onUnlink: (id: string) => void
  onAdd: () => void
}

/** Índice inferior de una nota: «Notas relacionadas» con extracto, quitar y «Relacionar». */
export function RelatedNotesSection({ notes, onOpen, onUnlink, onAdd }: RelatedNotesSectionProps): React.JSX.Element {
  return (
    <section aria-label="Notas relacionadas" className="px-6 pt-3 pb-4 shadow-[inset_0_1px_0_var(--color-hairline)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-caption font-extrabold text-milk-soft">
          Notas relacionadas{notes.length > 0 && <span className="ml-1.5 tabular-nums">{notes.length}</span>}
        </h2>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-micro font-bold text-milk transition-colors hover:bg-surface-raised"
        >
          <Link2 size={14} strokeWidth={2.5} className="text-apricot" />
          Relacionar
        </button>
      </div>
      {notes.length > 0 && (
        <ul className="scroll-area mt-2 max-h-40 overflow-y-auto rounded-md bg-surface [&>li+li]:shadow-[inset_0_1px_0_var(--color-hairline)]">
          {notes.map((n) => (
            <li key={n.id} className="group flex items-center gap-2 pr-2">
              <button
                type="button"
                onClick={() => onOpen(n.id)}
                className="min-w-0 flex-1 px-4 py-2.5 text-left transition-colors hover:bg-surface-raised"
              >
                <span className="block truncate text-list font-bold">{n.title}</span>
                {n.excerpt && <span className="block truncate text-caption text-milk-soft">{n.excerpt}</span>}
              </button>
              <button
                type="button"
                onClick={() => onUnlink(n.id)}
                aria-label={`Quitar relación con ${n.title}`}
                title="Quitar relación"
                className="grid size-8 shrink-0 place-items-center rounded-full text-milk-soft opacity-0 transition-[opacity,colors] group-hover:opacity-100 hover:bg-rose/15 hover:text-rose focus-visible:opacity-100"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
