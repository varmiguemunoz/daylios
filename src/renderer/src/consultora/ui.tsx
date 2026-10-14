import { useState, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { toggleTaskLine, type MeetingStatus, type ProjectStatus } from '@shared/consultora'
import { Markdown } from '../components/Markdown'

/**
 * Piezas pequeñas de la ventana Consultora, con el aspecto de Obsidian: grises neutros, fuente del
 * sistema, radios de 4 a 8 px, bordes de 1 px y sin sombras. Solo viven en Consultora, así que usan
 * los tokens `ob-*` directamente.
 */

export type PageVariant = 'table' | 'document' | 'board'

/**
 * Página. `table`: listas a todo el ancho. `document`: ficha como una nota de Obsidian, columna de
 * 760 px con el título en línea. `board`: el contenido ocupa todo el panel (pipeline).
 * Atrás vive en la franja superior, no en la página.
 */
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
      <div className="min-h-0 flex-1 overflow-y-auto">
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

/** Sección de una página: encabezado de 16 px con línea fina debajo, como un H2 de nota. */
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

/** Botón de Obsidian: `primary` = acento (la acción de la pantalla), `quiet` = gris, `danger` = rojo. */
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

/** Texto de una línea que se edita en el sitio. Guarda al salir o con Enter; Esc deshace. */
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

/**
 * Campo markdown: se lee renderizado, como una nota; «Editar», doble clic o clic si está vacío abre un textarea.
 * Guarda al salir o con ⌘Enter; Esc cancela. Las casillas `- [ ]` se marcan sin editar.
 */
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

/** Campo de texto de Obsidian: borde fino, fondo del documento, acento al enfocar. */
export const INPUT =
  'h-8 w-full rounded-[4px] border border-ob-border bg-ob-bg px-2.5 text-[14px] text-ob-text outline-none transition-colors placeholder:text-ob-faint focus:border-ob-accent'

/** Desplegable de Obsidian: gris, 30 px, radio 4. */
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

/** Tonos de etiqueta: los colores de Obsidian como tinte al 15 % con texto del color. */
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

/** Etiqueta de Obsidian: redondeada, 20 px, texto de 12. */
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

/** Cerrado = hecho (verde); activo = en marcha (violeta); en pausa = neutro. */
export function ProjectStatusPill({ status }: { status: ProjectStatus }): React.JSX.Element {
  const map: Record<ProjectStatus, [Tone, string]> = {
    activo: ['apricot', 'Activo'],
    pausa: ['neutral', 'En pausa'],
    cerrado: ['mint', 'Cerrado']
  }
  const [tone, label] = map[status]
  return <Pill tone={tone}>{label}</Pill>
}

/** Grabando = rojo (en vivo); procesando = amarillo; lista = nada; error = rojo. */
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

/** Vacío: texto tenue, sin tarjeta, como los estados vacíos de Obsidian. */
export function Empty({ title, hint }: { title: string; hint?: string }): React.JSX.Element {
  return (
    <div className="px-2 py-8 text-center">
      <p className="text-[14px] text-ob-muted">{title}</p>
      {hint && <p className="mt-1 text-[13px] text-ob-faint">{hint}</p>}
    </div>
  )
}

/** Lista como una tabla de Obsidian: filas con separador fino, sin tarjeta. */
export function List({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <ul className="border-t border-ob-border [&>li]:border-b [&>li]:border-ob-border">
      {children}
    </ul>
  )
}

/** Fila de una List: 32 px mínimo, resaltada al pasar el ratón. */
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

/** Campo con etiqueta: caja con borde fino; el foco la marca con el acento. */
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
