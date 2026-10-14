import type { ReactNode } from 'react'

/** Fila de ajustes de Obsidian: nombre y descripción a la izquierda, el control a la derecha. */
export function SettingRow({
  name,
  description,
  children
}: {
  name: string
  description?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-ob-border py-3 first:border-t-0">
      <div className="min-w-0 flex-1 basis-60">
        <p className="text-[15px] text-ob-text">{name}</p>
        {description && <div className="mt-0.5 text-[13px] text-ob-muted">{description}</div>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

/** Interruptor de Obsidian: pista redonda, violeta al activarse. */
export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-ob-accent' : 'bg-ob-active'
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 size-4 rounded-full bg-white transition-[left] ${
          checked ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}
