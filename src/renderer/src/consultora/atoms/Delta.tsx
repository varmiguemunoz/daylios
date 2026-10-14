import { ArrowDown, ArrowUp } from 'lucide-react'

export function Delta({
  current,
  previous,
  format = String,
  inverse = false
}: {
  current: number
  previous: number
  format?: (n: number) => string
  inverse?: boolean
}): React.JSX.Element {
  const diff = current - previous
  if (diff === 0) {
    return <span className="text-[12px] text-ob-muted">Igual que el periodo anterior</span>
  }
  const good = inverse ? diff < 0 : diff > 0
  const Icon = diff > 0 ? ArrowUp : ArrowDown
  const text = `${format(Math.abs(diff))} ${diff > 0 ? 'más' : 'menos'} que el periodo anterior`
  return (
    <span
      className={`inline-flex items-center gap-1 text-[12px] tabular-nums ${good ? 'text-ob-green' : 'text-ob-red'}`}
      aria-label={text}
      title={text}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden />
      {format(Math.abs(diff))}
      <span className="text-ob-muted">vs anterior</span>
    </span>
  )
}
