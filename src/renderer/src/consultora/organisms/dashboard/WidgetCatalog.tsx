import { Plus } from 'lucide-react'
import { WIDGET_KINDS, type WidgetKind } from '@shared/metrics'
import { Modal } from '../../../ui'
import { WIDGETS } from './registry'

export function WidgetCatalog({
  open,
  present,
  onAdd,
  onClose
}: {
  open: boolean
  present: Set<WidgetKind>
  onAdd: (kind: WidgetKind) => void
  onClose: () => void
}): React.JSX.Element | null {
  return (
    <Modal open={open} title="Añadir componente" onClose={onClose}>
      <ul className="flex flex-col">
        {WIDGET_KINDS.map((kind) => {
          const def = WIDGETS[kind]
          return (
            <li key={kind}>
              <button
                type="button"
                onClick={() => onAdd(kind)}
                className="flex w-full items-center gap-3 rounded-[6px] px-2 py-2 text-left transition-colors hover:bg-ob-hover"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-[4px] bg-ob-active text-ob-muted">
                  <Plus size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ob-text">{def.title}</span>
                  <span className="block truncate text-[12px] text-ob-muted">
                    {def.description}
                  </span>
                </span>
                {present.has(kind) && (
                  <span className="shrink-0 text-[12px] text-ob-faint">Ya está</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
