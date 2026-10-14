import { Diamond, FileText, Group, Image as ImageIcon, StickyNote } from 'lucide-react'

export type AddKind = 'card' | 'note' | 'media' | 'shape' | 'group'

export const CARD_DRAG = 'application/x-daylios-card'

const ITEMS: { kind: AddKind; label: string; Icon: typeof StickyNote }[] = [
  { kind: 'card', label: 'Tarjeta', Icon: StickyNote },
  { kind: 'note', label: 'Nota de la bóveda', Icon: FileText },
  { kind: 'media', label: 'Imagen o archivo', Icon: ImageIcon },
  { kind: 'shape', label: 'Forma', Icon: Diamond },
  { kind: 'group', label: 'Grupo', Icon: Group }
]

export function CardToolbar({
  onAdd
}: {
  onAdd: (kind: AddKind, anchor: HTMLElement) => void
}): React.JSX.Element {
  return (
    <div role="toolbar" aria-label="Añadir al board" className="ob-toolbar">
      {ITEMS.map(({ kind, label, Icon }) => (
        <button
          key={kind}
          type="button"
          aria-label={label}
          title={kind === 'card' || kind === 'group' ? `${label} · arrastra al lienzo` : label}
          draggable={kind === 'card' || kind === 'group'}
          onDragStart={(e) => {
            e.dataTransfer.setData(CARD_DRAG, kind)
            e.dataTransfer.effectAllowed = 'copy'
          }}
          onClick={(e) => onAdd(kind, e.currentTarget)}
          className="ob-tool"
        >
          <Icon size={18} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  )
}
