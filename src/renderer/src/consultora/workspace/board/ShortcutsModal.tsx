import { Kbd, Modal } from '../../../ui'
import { SHORTCUTS } from './shortcuts'

export function ShortcutsModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <Modal open size="md" title="Atajos del board" onClose={onClose}>
      <div className="grid gap-5 sm:grid-cols-2">
        {SHORTCUTS.map((group) => (
          <section key={group.title} className="flex flex-col gap-2">
            <h3 className="text-[12px] font-semibold tracking-wide text-ob-muted uppercase">
              {group.title}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {group.items.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-ob-text">{s.label}</span>
                  <Kbd>{s.keys}</Kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}
