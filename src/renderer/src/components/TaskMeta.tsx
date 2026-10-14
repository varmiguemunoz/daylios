import type { Effort } from '@shared/tasks'

export function TagChips({
  tags,
  size = 'sm'
}: {
  tags: string[]
  size?: 'sm' | 'md'
}): React.JSX.Element | null {
  if (!tags.length) return null
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex shrink-0 items-center rounded-full bg-surface-raised font-bold text-milk-soft ${
            size === 'sm' ? 'h-5 px-2 text-[12px]' : 'h-6 px-2.5 text-micro'
          }`}
        >
          #{tag}
        </span>
      ))}
    </span>
  )
}

const LEVEL: Record<Effort, number> = { bajo: 1, medio: 2, alto: 3 }

export function EffortBars({ effort }: { effort: Effort | null }): React.JSX.Element | null {
  if (!effort) return null
  const level = LEVEL[effort]
  return (
    <span
      className="flex h-3 shrink-0 items-end gap-[2px]"
      role="img"
      aria-label={`Esfuerzo ${effort}`}
      title={`Esfuerzo ${effort}`}
    >
      {[8, 10, 12].map((height, i) => (
        <span
          key={height}
          style={{ height }}
          className={`w-[3px] rounded-full ${i < level ? 'bg-milk-soft' : 'bg-hairline'}`}
        />
      ))}
    </span>
  )
}
