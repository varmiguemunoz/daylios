import type { ReactNode } from 'react'

export function StatValue({
  value,
  caption
}: {
  value: string
  caption?: ReactNode
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className="truncate text-[28px] leading-none font-semibold tracking-[-0.01em] text-ob-text tabular-nums">
        {value}
      </p>
      {caption && <p className="mt-1.5 truncate text-[12px] text-ob-muted">{caption}</p>}
    </div>
  )
}
