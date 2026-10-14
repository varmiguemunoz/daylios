import type { ReactNode } from 'react'

interface IconButtonProps {
  label: string
  onClick: () => void
  children: ReactNode
  /** danger = rose al pasar el ratón (borrar). */
  tone?: 'default' | 'danger'
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
}

/** Botón redondo solo con icono. `label` es el nombre accesible y el tooltip. */
export function IconButton({
  label,
  onClick,
  children,
  tone = 'default',
  size = 'md',
  disabled,
  className = ''
}: IconButtonProps): React.JSX.Element {
  const hover =
    tone === 'danger'
      ? 'hover:bg-rose/15 hover:text-rose'
      : 'hover:bg-surface-raised hover:text-milk'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`ui-icon-btn ${tone === 'danger' ? 'ui-danger' : ''} grid shrink-0 place-items-center rounded-full text-milk-soft transition-colors disabled:text-milk-faint ${
        size === 'sm' ? 'size-8' : 'size-9'
      } ${hover} ${className}`}
    >
      {children}
    </button>
  )
}
