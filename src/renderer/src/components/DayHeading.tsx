import type { ReactNode } from 'react'

export function DayHeading({
  children,
  aside
}: {
  children: ReactNode
  aside?: ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 px-1">
      <h2 className="ui-heading text-label font-extrabold">{children}</h2>
      {aside}
    </div>
  )
}
