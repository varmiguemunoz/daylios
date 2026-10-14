import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useOverlay } from '../../ui/organisms/overlay'

export interface SwitcherOption {
  key: string
  icon: ReactNode
  title: string
  hint?: string

  group?: string

  action?: boolean
}

interface SwitcherFrameProps {
  label: string
  placeholder: string
  query: string
  onQuery: (query: string) => void
  options: SwitcherOption[]
  index: number
  onIndex: (index: number) => void

  onChoose: (index: number, alt: boolean) => void
  empty: string
  hints: string[]
  onClose: () => void
}

export function SwitcherFrame({
  label,
  placeholder,
  query,
  onQuery,
  options,
  index,
  onIndex,
  onChoose,
  empty,
  hints,
  onClose
}: SwitcherFrameProps): React.JSX.Element {
  const panel = useRef<HTMLDivElement>(null)
  useOverlay(true, onClose, panel)
  const total = options.length
  const current = Math.min(index, Math.max(0, total - 1))

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/40 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-label={label}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-fit max-h-[70vh] w-[min(600px,calc(100vw-48px))] flex-col overflow-hidden rounded-[8px] border border-ob-border bg-ob-alt font-ob text-ob-text shadow-[0_16px_48px_-12px_rgb(0_0_0/0.8)] outline-none"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            onQuery(e.target.value)
            onIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              onIndex((current + 1) % Math.max(1, total))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              onIndex((current - 1 + total) % Math.max(1, total))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (total) onChoose(current, e.shiftKey || e.metaKey || e.ctrlKey)
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-12 shrink-0 border-b border-ob-border bg-transparent px-4 text-[15px] outline-none placeholder:text-ob-faint"
        />
        <ul role="listbox" aria-label="Resultados" className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {options.map((o, i) => (
            <li key={o.key} role="option" aria-selected={i === current}>
              {o.group && (
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-ob-faint">{o.group}</p>
              )}
              <button
                type="button"
                onMouseEnter={() => onIndex(i)}
                onClick={() => onChoose(i, false)}
                className={`flex w-full items-start gap-2.5 rounded-[4px] px-3 py-1.5 text-left ${
                  i === current ? 'bg-ob-active' : ''
                }`}
              >
                <span className="mt-[3px] shrink-0 text-ob-faint" aria-hidden>
                  {o.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[14px] ${o.action ? 'text-ob-muted' : 'text-ob-text'}`}
                  >
                    {o.title}
                  </span>
                  {o.hint && (
                    <span className="block truncate text-[12px] text-ob-faint">{o.hint}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {!total && <li className="px-3 py-3 text-[13px] text-ob-faint">{empty}</li>}
        </ul>
        <p className="flex shrink-0 flex-wrap gap-x-4 border-t border-ob-border px-4 py-2 text-[11px] text-ob-faint">
          {hints.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </p>
      </div>
    </div>,
    document.body
  )
}
