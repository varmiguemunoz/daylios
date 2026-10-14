export function CountBadge({
  count,
  tone = 'neutral'
}: {
  count: number
  tone?: 'apricot' | 'neutral'
}): React.JSX.Element {
  return (
    <span
      className={`ui-badge ${tone === 'apricot' ? 'ui-accent' : ''} inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-micro font-extrabold tabular-nums ${
        tone === 'apricot' ? 'bg-apricot text-ink' : 'bg-surface-raised text-milk-soft'
      }`}
    >
      {count}
    </span>
  )
}
