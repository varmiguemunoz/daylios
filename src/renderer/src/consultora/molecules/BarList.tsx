export interface BarItem {
  id: string
  label: string
  value: number

  display: string
}

export function BarList({
  items,
  onSelect
}: {
  items: BarItem[]
  onSelect?: (item: BarItem) => void
}): React.JSX.Element {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => {
        const body = (
          <>
            <span className="w-[34%] shrink-0 truncate text-left text-[13px] text-ob-text">
              {item.label}
            </span>
            <span className="relative h-2 min-w-0 flex-1 rounded-full bg-ob-active">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-ob-accent"
                style={{ width: `${Math.max((item.value / max) * 100, item.value ? 2 : 0)}%` }}
              />
            </span>
            <span className="w-[72px] shrink-0 text-right text-[12px] text-ob-muted tabular-nums">
              {item.display}
            </span>
          </>
        )
        return (
          <li key={item.id}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="flex w-full items-center gap-2 rounded-[4px] px-1 py-0.5 transition-colors hover:bg-ob-hover"
              >
                {body}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-1 py-0.5">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
