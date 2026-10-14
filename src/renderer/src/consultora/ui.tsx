import { useContext, useRef, useState, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { toggleTaskLine, type MeetingStatus, type ProjectStatus } from '@shared/consultora'
import { Markdown } from '../components/Markdown'
import { useScrollMemory } from '../lib/ui-state'
import { ScrollKeyContext } from './chrome'

export type PageVariant = 'table' | 'document' | 'board'

export function Page({
  variant = 'table',
  title,
  meta,
  actions,
  children
}: {
  variant?: PageVariant
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  const isDoc = variant === 'document'
  // El scroll de cada pantalla se recuerda: volver atrás la deja donde estaba.
  const scroller = useRef<HTMLDivElement>(null)
  useScrollMemory(scroller, useContext(ScrollKeyContext))
  const header = (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div className="min-w-[220px] flex-1">
        <div
          className={
            isDoc
              ? 'text-[28px] leading-tight font-bold tracking-[-0.015em] text-ob-text'
              : 'text-[20px] leading-tight font-semibold text-ob-text'
          }
        >
          {title}
        </div>
        {meta && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-ob-muted">
            {meta}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
    </header>
  )

  if (variant === 'board') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 px-6 pt-5 pb-3">{header}</div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    )
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={`@container mx-auto ${
            isDoc ? 'max-w-[808px] px-6 pt-10 pb-24' : 'max-w-[1200px] px-6 pt-5 pb-16'
          }`}
        >
          {header}
          {children}
        </div>
      </div>
    </div>
  )
}

export function Section({
  title,
  aside,
  children
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <section className="mt-8">
      <div className="mb-2 flex min-h-8 items-center justify-between gap-3 border-b border-ob-border pb-1.5">
        <h2 className="text-[16px] font-semibold text-ob-text">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

const BUTTON = {
  primary: 'bg-ob-accent text-white hover:bg-[#7a4fe0]',
  quiet: 'bg-ob-active text-ob-text hover:bg-[#3f3f3f]',
  danger: 'bg-ob-active text-ob-red hover:bg-ob-red/15'
}

export function Button({
  children,
  onClick,
  kind = 'quiet',
  disabled,
  title
}: {
  children: ReactNode
  onClick: () => void
  kind?: keyof typeof BUTTON
  disabled?: boolean
  title?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-[30px] shrink-0 items-center gap-1.5 rounded-[4px] px-3 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${BUTTON[kind]}`}
    >
      {children}
    </button>
  )
}

export function EditableText({
  value,
  onSave,
  placeholder,
  label,
  className = ''
}: {
  value: string
  onSave: (value: string) => void
  placeholder?: string
  label: string
  className?: string
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? value

  const commit = (): void => {
    if (draft !== null && draft.trim() !== value) onSave(draft.trim())
    setDraft(null)
  }

  return (
    <input
      value={shown}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(null)
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur())
        }
      }}
      className={`-mx-1.5 w-[calc(100%+12px)] min-w-0 rounded-[4px] bg-transparent px-1.5 outline-none transition-colors placeholder:text-ob-faint hover:bg-ob-hover focus:bg-ob-hover ${className}`}
    />
  )
}

export function MarkdownField({
  value,
  onSave,
  placeholder
}: {
  value: string
  onSave: (value: string) => void
  placeholder: string
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)

  if (draft !== null) {
    const commit = (): void => {
      if (draft !== value) onSave(draft)
      setDraft(null)
    }
    return (
      <textarea
        autoFocus
        value={draft}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            setDraft(null)
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            commit()
          } else if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault()
            const el = e.currentTarget
            el.setRangeText('  ', el.selectionStart, el.selectionEnd, 'end')
            setDraft(el.value)
          }
        }}
        className="block min-h-28 w-full resize-none rounded-[4px] border border-ob-border bg-ob-bg px-3 py-2.5 text-[15px] leading-relaxed text-ob-text outline-none [field-sizing:content] placeholder:text-ob-faint focus:border-ob-accent"
      />
    )
  }

  if (!value.trim()) {
    return (
      <button
        type="button"
        onClick={() => setDraft('')}
        className="w-full rounded-[4px] px-3 py-2.5 text-left text-[14px] text-ob-faint transition-colors hover:bg-ob-hover hover:text-ob-muted"
      >
        {placeholder}
      </button>
    )
  }

  return (
    <div
      className="group relative -mx-3 rounded-[4px] px-3 py-2 text-[15px] transition-colors hover:bg-ob-hover/50"
      onDoubleClick={() => setDraft(value)}
    >
      <button
        type="button"
        onClick={() => setDraft(value)}
        aria-label="Editar"
        title="Editar (doble clic)"
        className="absolute top-1.5 right-1.5 hidden size-7 place-items-center rounded-[4px] text-ob-muted group-hover:grid hover:bg-ob-active hover:text-ob-text"
      >
        <Pencil size={15} />
      </button>
      <Markdown text={value} onToggleTask={(line) => onSave(toggleTaskLine(value, line))} />
    </div>
  )
}

export const INPUT =
  'h-8 w-full rounded-[4px] border border-ob-border bg-ob-bg px-2.5 text-[14px] text-ob-text outline-none transition-colors placeholder:text-ob-faint focus:border-ob-accent'

export function Select({
  value,
  options,
  onChange,
  label
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  label: string
}): React.JSX.Element {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className="h-[30px] max-w-full cursor-pointer rounded-[4px] bg-ob-active px-2.5 text-[13px] text-ob-text outline-none hover:bg-[#3f3f3f] focus-visible:outline-2 focus-visible:outline-ob-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export type Tone = 'mint' | 'apricot' | 'rose' | 'coral' | 'butter' | 'cyan' | 'orange' | 'neutral'

export const TONES: Record<Tone, string> = {
  mint: 'bg-ob-green/15 text-ob-green',
  apricot: 'bg-ob-accent/15 text-ob-link',
  rose: 'bg-ob-red/15 text-ob-red',
  coral: 'bg-ob-red/15 text-ob-red',
  butter: 'bg-ob-yellow/15 text-ob-yellow',
  cyan: 'bg-ob-cyan/15 text-ob-cyan',
  orange: 'bg-ob-orange/15 text-ob-orange',
  neutral: 'bg-ob-active text-ob-muted'
}

export function Pill({
  tone = 'neutral',
  children
}: {
  tone?: Tone
  children: ReactNode
}): React.JSX.Element {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[12px] font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

export function ProjectStatusPill({ status }: { status: ProjectStatus }): React.JSX.Element {
  const map: Record<ProjectStatus, [Tone, string]> = {
    activo: ['apricot', 'Activo'],
    pausa: ['neutral', 'En pausa'],
    cerrado: ['mint', 'Cerrado']
  }
  const [tone, label] = map[status]
  return <Pill tone={tone}>{label}</Pill>
}

export function MeetingStatusPill({ status }: { status: MeetingStatus }): React.JSX.Element | null {
  const map: Record<MeetingStatus, [Tone, string] | null> = {
    recording: ['rose', '● Grabando'],
    transcribing: ['butter', 'Transcribiendo…'],
    summarizing: ['butter', 'Resumiendo…'],
    ready: null,
    error: ['coral', 'Error']
  }
  const entry = map[status]
  return entry ? <Pill tone={entry[0]}>{entry[1]}</Pill> : null
}

export function ErrorNote({ message }: { message: string | null }): React.JSX.Element | null {
  if (!message) return null
  return (
    <p
      role="alert"
      className="mt-4 rounded-[4px] border border-ob-red/30 bg-ob-red/10 px-3 py-2 text-[13px] text-ob-red"
    >
      {message}
    </p>
  )
}

export function Empty({ title, hint }: { title: string; hint?: string }): React.JSX.Element {
  return (
    <div className="px-2 py-8 text-center">
      <p className="text-[14px] text-ob-muted">{title}</p>
      {hint && <p className="mt-1 text-[13px] text-ob-faint">{hint}</p>}
    </div>
  )
}

export function List({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <ul className="border-t border-ob-border [&>li]:border-b [&>li]:border-ob-border">
      {children}
    </ul>
  )
}

export function Row({
  onClick,
  children
}: {
  onClick?: () => void
  children: ReactNode
}): React.JSX.Element {
  const inner = 'flex min-h-8 w-full items-center gap-3 px-2 py-1.5 text-left text-[14px]'
  return (
    <li>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={`${inner} transition-colors outline-offset-[-2px] hover:bg-ob-hover focus-visible:bg-ob-hover`}
        >
          {children}
        </button>
      ) : (
        <div className={inner}>{children}</div>
      )}
    </li>
  )
}

export function Field({
  label,
  children
}: {
  label: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <label className="flex min-w-0 flex-col gap-0.5 rounded-[4px] border border-ob-border bg-ob-bg px-2.5 py-1.5 transition-colors focus-within:border-ob-accent">
      <span className="text-[11px] font-medium text-ob-muted">{label}</span>
      {children}
    </label>
  )
}

// Primitivas compartidas (diseño atómico), re-exportadas para no tocar imports.
export * from '../ui'
