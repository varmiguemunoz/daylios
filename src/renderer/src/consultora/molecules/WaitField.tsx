const UNITS = [
  { value: 'hour', label: 'horas' },
  { value: 'day', label: 'días' },
  { value: 'week', label: 'semanas' }
]

export function parseWait(wait: string): { amount: number; unit: string } {
  const match = /^(\d{1,3}) (minute|hour|day|week)s?$/.exec(wait.trim().toLowerCase())
  if (!match) return { amount: 2, unit: 'day' }
  return { amount: Number(match[1]), unit: match[2] === 'minute' ? 'hour' : match[2] }
}

export const formatWait = (amount: number, unit: string): string =>
  `${amount} ${unit}${amount === 1 ? '' : 's'}`

export function WaitField({
  value,
  onChange
}: {
  value: string
  onChange: (wait: string) => void
}): React.JSX.Element {
  const { amount, unit } = parseWait(value)
  const field =
    'rounded-[4px] border border-ob-border bg-ob-bg px-2 py-1 text-[14px] text-ob-text outline-none focus:border-ob-accent'
  return (
    <span className="flex items-center gap-2 text-[13px] text-ob-muted">
      Esperar
      <input
        type="number"
        min={1}
        max={365}
        value={amount}
        aria-label="Cantidad de espera"
        onChange={(e) => onChange(formatWait(Math.max(1, Number(e.target.value) || 1), unit))}
        className={`${field} w-16`}
      />
      <select
        value={unit}
        aria-label="Unidad de espera"
        onChange={(e) => onChange(formatWait(amount, e.target.value))}
        className={`${field} cursor-pointer`}
      >
        {UNITS.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </select>
      después del anterior
    </span>
  )
}
