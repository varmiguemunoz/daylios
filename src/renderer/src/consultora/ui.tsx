import { useState, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { toggleTaskLine, type MeetingStatus, type ProjectStatus } from '@shared/consultora'
import { Markdown } from '../components/Markdown'
import { BackButton } from '../components/BackButton'

/**
 * Piezas pequeñas de la ventana Consultora. Mismo mundo que DayliOS (DESIGN.md):
 * noche, superficies tonales, Nunito, pills; cada color con un significado.
 */

/** Página: Atrás opcional, título, acciones a la derecha y contenido con scroll. */
export function Page({
  back,
  title,
  meta,
  actions,
  children
}: {
  back?: { label: string; onClick: () => void }
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="scroll-area min-h-0 flex-1 overflow-y-auto pt-6 pb-16 pl-10">
        <div className="mx-auto max-w-[880px]">
          {back && (
            <div className="mb-4">
              <BackButton label={back.label} onClick={back.onClick} />
            </div>
          )}
          <header className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="text-headline font-extrabold">{title}</div>
              {meta && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-caption text-milk-soft">
                  {meta}
                </div>
              )}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2 pt-2">{actions}</div>}
          </header>
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
    <section className="mt-9">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <h2 className="text-label font-extrabold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** Botón: `primary` = apricot (la acción de la pantalla), `quiet` = superficie. */
export function Button({
  children,
  onClick,
  kind = 'quiet',
  disabled,
  title
}: {
  children: ReactNode
  onClick: () => void
  kind?: 'primary' | 'quiet' | 'danger'
  disabled?: boolean
  title?: string
}): React.JSX.Element {
  const look = {
    primary: 'bg-apricot text-ink active:scale-95',
    quiet: 'bg-surface text-milk hover:bg-surface-raised',
    danger: 'bg-surface text-milk-soft hover:bg-rose/15 hover:text-rose'
  }[kind]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-caption font-extrabold transition-[background-color,color,transform] disabled:bg-surface-raised disabled:text-milk-faint ${look}`}
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
      className={`-mx-2 w-[calc(100%+16px)] min-w-0 rounded-sm bg-transparent px-2 outline-none transition-colors hover:bg-surface focus:bg-surface ${className}`}
    />
  )
}

/**
 * Campo markdown: se lee renderizado; «Editar» (o clic si está vacío) abre un textarea.
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
        className="block min-h-28 w-full resize-none rounded-md bg-surface px-5 py-4 text-list leading-relaxed outline-none [field-sizing:content] focus:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]"
      />
    )
  }

  if (!value.trim()) {
    return (
      <button
        type="button"
        onClick={() => setDraft('')}
        className="w-full rounded-md bg-surface/60 px-5 py-4 text-left text-caption text-milk-soft transition-colors hover:bg-surface"
      >
        {placeholder}
      </button>
    )
  }

  return (
    <div
      className="group relative rounded-md bg-surface px-5 py-4 text-list"
      onDoubleClick={() => setDraft(value)}
    >
      <button
        type="button"
        onClick={() => setDraft(value)}
        aria-label="Editar"
        title="Editar (doble clic)"
        className="absolute top-2.5 right-2.5 hidden size-8 place-items-center rounded-full text-milk-soft group-hover:grid hover:bg-hairline hover:text-milk"
      >
        <Pencil size={15} />
      </button>
      <Markdown text={value} onToggleTask={(line) => onSave(toggleTaskLine(value, line))} />
    </div>
  )
}

/** Selector nativo con estilo de pill. */
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
      className="h-9 max-w-full cursor-pointer rounded-full bg-surface px-3.5 text-caption font-bold text-milk outline-none hover:bg-surface-raised"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

type Tone = 'mint' | 'apricot' | 'rose' | 'coral' | 'neutral'

const TONES: Record<Tone, string> = {
  mint: 'bg-mint/15 text-mint',
  apricot: 'bg-apricot/15 text-apricot',
  rose: 'bg-rose/15 text-rose',
  coral: 'bg-coral/15 text-coral',
  neutral: 'bg-surface-raised text-milk-soft'
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
      className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-micro font-bold ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

/** Cerrado = hecho (mint); activo = en marcha (apricot); en pausa = neutro. */
export function ProjectStatusPill({ status }: { status: ProjectStatus }): React.JSX.Element {
  const map: Record<ProjectStatus, [Tone, string]> = {
    activo: ['apricot', 'Activo'],
    pausa: ['neutral', 'En pausa'],
    cerrado: ['mint', 'Cerrado']
  }
  const [tone, label] = map[status]
  return <Pill tone={tone}>{label}</Pill>
}

/** Grabando = rose (en vivo); procesando = apricot; lista = mint; error = coral. */
export function MeetingStatusPill({ status }: { status: MeetingStatus }): React.JSX.Element | null {
  const map: Record<MeetingStatus, [Tone, string] | null> = {
    recording: ['rose', '● Grabando'],
    transcribing: ['apricot', 'Transcribiendo…'],
    summarizing: ['apricot', 'Resumiendo…'],
    ready: null,
    error: ['coral', 'Error']
  }
  const entry = map[status]
  return entry ? <Pill tone={entry[0]}>{entry[1]}</Pill> : null
}

export function ErrorNote({ message }: { message: string | null }): React.JSX.Element | null {
  if (!message) return null
  return (
    <p role="alert" className="mt-4 rounded-md bg-coral/12 px-4 py-3 text-caption text-coral">
      {message}
    </p>
  )
}

export function Empty({ title, hint }: { title: string; hint?: string }): React.JSX.Element {
  return (
    <div className="rounded-md bg-surface/60 px-5 py-4">
      <p className="text-list font-bold">{title}</p>
      {hint && <p className="mt-0.5 text-caption text-milk-soft">{hint}</p>}
    </div>
  )
}

/** Lista en tarjeta con separadores finos (patrón de Historial). */
export function List({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <ul className="overflow-hidden rounded-md bg-surface [&>li+li]:shadow-[inset_0_1px_0_var(--color-hairline)]">
      {children}
    </ul>
  )
}

/** Fila clicable dentro de una List. */
export function Row({
  onClick,
  children
}: {
  onClick?: () => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <li>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-offset-[-2px] hover:bg-surface-raised focus-visible:bg-surface-raised"
        >
          {children}
        </button>
      ) : (
        <div className="flex w-full items-center gap-3 px-4 py-3">{children}</div>
      )}
    </li>
  )
}

/** Campo pequeño con etiqueta (formularios de una línea). */
export function Field({
  label,
  children
}: {
  label: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <label className="flex min-w-0 flex-col gap-1 rounded-sm bg-surface px-3.5 py-2">
      <span className="text-micro font-bold text-milk-soft">{label}</span>
      {children}
    </label>
  )
}
