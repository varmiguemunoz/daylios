import type { LucideIcon } from 'lucide-react'

interface SegmentedToggleProps<T extends string> {
  label: string
  value: T
  options: { id: T; label: string; icon?: LucideIcon }[]
  onChange: (value: T) => void
}

/** Control segmentado (rail del tab switcher, items de 32px). */
export function SegmentedToggle<T extends string>({
  label,
  value,
  options,
  onChange
}: SegmentedToggleProps<T>): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="ui-segmented flex shrink-0 rounded-full bg-surface p-1"
    >
      {options.map(({ id, label: text, icon: Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={`ui-seg ${active ? 'ui-active' : ''} flex h-8 items-center gap-1.5 rounded-full px-3 text-caption font-bold transition-colors ${
              active ? 'bg-surface-raised text-milk' : 'text-milk-soft hover:text-milk'
            }`}
          >
            {Icon && <Icon size={15} strokeWidth={2.5} className={active ? 'text-apricot' : ''} />}
            {text}
          </button>
        )
      })}
    </div>
  )
}
