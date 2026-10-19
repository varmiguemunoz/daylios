import { SettingRow } from './SettingRow'

export interface RoleOption {
  value: string
  label: string
}

export function RoleRow({
  name,
  description,
  value,
  options,
  status,
  ok,
  onChange
}: {
  name: string
  description: string
  value: string
  options: RoleOption[]
  status: string
  ok: boolean
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <SettingRow name={name} description={description}>
      <span
        className={`rounded-[4px] px-2 py-0.5 text-[12px] ${ok ? 'bg-ob-green/10 text-ob-green' : 'bg-ob-active text-ob-muted'}`}
      >
        {status}
      </span>
      <select
        aria-label={`Proveedor para ${name}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer rounded-[4px] border border-ob-border bg-ob-bg px-2.5 py-1.5 text-[14px] text-ob-text outline-none focus:border-ob-accent"
      >
        <option value="">Sin asignar</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </SettingRow>
  )
}
