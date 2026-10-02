import type { ReactNode } from 'react'

/** Título de un día en listas por fecha (Historial, Notas), con un hueco a la derecha. */
export function DayHeading({
  children,
  aside
}: {
  children: ReactNode
  aside?: ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 px-1">
      <h2 className="text-label font-extrabold">{children}</h2>
      {aside}
    </div>
  )
}
