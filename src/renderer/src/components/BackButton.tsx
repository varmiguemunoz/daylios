import { ChevronLeft } from 'lucide-react'

/** Botón «‹ Volver» de las pantallas de detalle. `Esc` hace lo mismo. */
export function BackButton({
  label,
  onClick
}: {
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Volver a ${label} (Esc)`}
      className="flex h-9 items-center gap-0.5 rounded-full bg-surface pr-4 pl-2 text-caption font-bold text-milk transition-colors hover:bg-surface-raised"
    >
      <ChevronLeft size={18} strokeWidth={2.5} className="text-apricot" />
      {label}
    </button>
  )
}
