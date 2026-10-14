import type { PresenceMember } from '@shared/presence'

export function PresenceStack({
  members,
  here = new Set<string>(),
  max = 4
}: {
  members: PresenceMember[]
  here?: ReadonlySet<string>
  max?: number
}): React.JSX.Element | null {
  if (!members.length) return null
  const shown = members.slice(0, max)
  const rest = members.length - shown.length
  const names = members.map((m) => m.name ?? 'Miembro').join(', ')
  return (
    <div
      role="group"
      aria-label={`Conectados: ${names}`}
      title={names}
      className="flex items-center"
    >
      {shown.map((m, i) => (
        <span
          key={m.userId}
          style={{ zIndex: shown.length - i }}
          className={`-ml-1.5 grid size-5 place-items-center rounded-full bg-ob-alt text-[9px] font-semibold first:ml-0 ${
            here.has(m.userId)
              ? 'text-ob-link ring-2 ring-ob-accent'
              : 'text-ob-muted ring-2 ring-ob-alt'
          }`}
        >
          <span className="grid size-full place-items-center rounded-full bg-ob-active">
            {m.initials}
          </span>
        </span>
      ))}
      {rest > 0 && (
        <span className="-ml-1.5 grid size-5 place-items-center rounded-full bg-ob-active text-[9px] text-ob-muted ring-2 ring-ob-alt">
          +{rest}
        </span>
      )}
    </div>
  )
}
