const W = 100
const H = 28

export function Sparkline({ values }: { values: number[] }): React.JSX.Element | null {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const step = W / (values.length - 1)
  const points = values.map(
    (v, i) => `${(i * step).toFixed(2)},${(H - 2 - (v / max) * (H - 4)).toFixed(2)}`
  )
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      className="h-7 w-full overflow-visible"
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--color-ob-accent)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
