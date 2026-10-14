import type { HTMLAttributes, ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { CountBadge } from '../../../ui'

interface KanbanColumnProps {
  title: string
  count: number

  dot?: 'green' | 'faint'

  muted?: boolean

  aside?: ReactNode

  onAdd?: () => void
  addLabel?: string

  highlight?: boolean
  width?: number

  bodyProps?: HTMLAttributes<HTMLDivElement>
  children: ReactNode
}

export function KanbanColumn({
  title,
  count,
  dot,
  muted = false,
  aside,
  onAdd,
  addLabel,
  highlight = false,
  width = 280,
  bodyProps,
  children
}: KanbanColumnProps): React.JSX.Element {
  return (
    <section
      className={`flex shrink-0 flex-col rounded-[8px] border bg-ob-alt transition-colors ${
        highlight ? 'border-ob-accent/60' : 'border-ob-border'
      }`}
      style={{ width }}
      aria-label={title}
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 pr-1.5 pl-3">
        <span className="flex min-w-0 items-center gap-1.5">
          {dot && (
            <span
              aria-hidden
              className={`size-2 shrink-0 rounded-full ${dot === 'green' ? 'bg-ob-green' : 'bg-ob-faint'}`}
            />
          )}
          <span
            className={`min-w-0 truncate text-[13px] font-semibold ${muted ? 'text-ob-muted' : 'text-ob-text'}`}
          >
            {title}
          </span>
          <CountBadge count={count} />
        </span>
        <span className="flex items-center gap-1">
          {aside}
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              aria-label={addLabel ?? `Nuevo en ${title}`}
              title={addLabel ?? 'Nuevo aquí'}
              className="grid size-7 place-items-center rounded-[4px] text-ob-muted transition-colors hover:bg-ob-hover hover:text-ob-text"
            >
              <Plus size={15} />
            </button>
          )}
        </span>
      </div>
      <div
        {...bodyProps}
        className={`flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto px-1.5 pb-1.5 ${bodyProps?.className ?? ''}`}
      >
        {children}
      </div>
    </section>
  )
}

export function KanbanAddField({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  label
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  placeholder: string
  label: string
}): React.JSX.Element {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => !value.trim() && onCancel()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onCancel()
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        className="h-8 w-full rounded-[4px] border border-ob-accent bg-ob-bg px-2.5 text-[14px] text-ob-text outline-none placeholder:text-ob-faint"
      />
    </form>
  )
}
