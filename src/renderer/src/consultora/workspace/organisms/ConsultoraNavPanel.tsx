import { useRef } from 'react'
import { useChrome } from '../../chrome'
import { EMAIL_SECTIONS, SECTIONS, type SectionLink } from '../../sections'
import { useOverlay } from '../../../ui/organisms/overlay'

/** La navegación de Consultora, flotando junto a la cinta. Esc o clic fuera la cierran. */
export function ConsultoraNavPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const panel = useRef<HTMLDivElement>(null)
  const { openSection } = useChrome()
  useOverlay(true, onClose, panel)

  const row = (s: SectionLink): React.JSX.Element => {
    const Icon = s.icon
    const here = s.id === 'workspace'
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => {
          onClose()
          if (!here) openSection(s.id)
        }}
        aria-current={here ? 'page' : undefined}
        className={`flex h-[30px] w-full items-center gap-2.5 rounded-[4px] px-2.5 text-left text-[13px] transition-colors hover:bg-ob-hover hover:text-ob-text ${
          here ? 'bg-ob-active text-ob-text' : 'text-ob-muted'
        }`}
      >
        <Icon size={15} strokeWidth={2} className="shrink-0" aria-hidden />
        {s.label}
      </button>
    )
  }

  return (
    <>
      <div aria-hidden className="absolute inset-0 z-30" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-label="Consultora"
        tabIndex={-1}
        className="absolute top-0 bottom-0 left-11 z-40 flex w-56 flex-col gap-0.5 border-r border-ob-border bg-ob-alt p-2 shadow-[12px_0_32px_-16px_rgb(0_0_0/0.8)] outline-none"
      >
        <p className="px-2.5 pt-1 pb-2 text-[12px] font-semibold text-ob-faint">Consultora</p>
        {SECTIONS.map(row)}
        <p className="px-2.5 pt-4 pb-2 text-[12px] font-semibold text-ob-faint">Email</p>
        {EMAIL_SECTIONS.map(row)}
      </div>
    </>
  )
}
