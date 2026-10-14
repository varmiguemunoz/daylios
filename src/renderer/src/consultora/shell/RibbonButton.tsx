import type { ReactNode } from 'react'

/** Botón de icono de la cinta y de la franja, como los de Obsidian: 28 px, gris, sin borde. */
export function RibbonButton({
  label,
  onClick,
  active = false,
  disabled = false,
  children
}: {
  label: string
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  active?: boolean
  disabled?: boolean
  children: ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-7 shrink-0 place-items-center rounded-[4px] transition-colors hover:bg-ob-hover hover:text-ob-text disabled:pointer-events-none disabled:opacity-35 ${
        active ? 'text-ob-text' : 'text-ob-muted'
      }`}
    >
      {children}
    </button>
  )
}
