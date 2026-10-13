import { useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'

interface ConfirmButtonProps {
  /** Nombre accesible en reposo («Borrar contacto»). */
  label: string
  onConfirm: () => void
  /** Texto del segundo paso. */
  confirmLabel?: string
  icon?: ReactNode
  size?: 'sm' | 'md'
}

/** Borrar en dos pasos: el primer clic pide confirmación; salir del botón lo resetea. */
export function ConfirmButton({
  label,
  onConfirm,
  confirmLabel = '¿Borrar?',
  icon = <Trash2 size={16} />,
  size = 'md'
}: ConfirmButtonProps): React.JSX.Element {
  const [armed, setArmed] = useState(false)
  const height = size === 'sm' ? 'h-8' : 'h-9'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (!armed) return setArmed(true)
        setArmed(false)
        onConfirm()
      }}
      onMouseLeave={() => setArmed(false)}
      onBlur={() => setArmed(false)}
      aria-label={armed ? `Confirmar: ${label}` : label}
      title={label}
      className={`flex shrink-0 items-center justify-center rounded-full text-caption font-extrabold transition-colors ${height} ${
        armed ? 'bg-rose px-4 text-ink' : `${size === 'sm' ? 'w-8' : 'w-9'} text-milk-soft hover:bg-rose/15 hover:text-rose`
      }`}
    >
      {armed ? confirmLabel : icon}
    </button>
  )
}
