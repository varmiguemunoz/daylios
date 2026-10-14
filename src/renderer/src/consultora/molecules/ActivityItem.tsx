import { Initials } from './Initials'

const timeFmt = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })

export function ActivityItem({
  actor,
  phrase,
  at,
  onOpen
}: {
  actor: string
  phrase: string
  at: string
  onOpen?: () => void
}): React.JSX.Element {
  const body = (
    <>
      <Initials name={actor} size={20} />
      <span className="min-w-0 flex-1 text-[12px] leading-snug text-ob-text">{phrase}</span>
      <time dateTime={at} className="shrink-0 text-[11px] text-ob-faint tabular-nums">
        {timeFmt.format(new Date(at))}
      </time>
    </>
  )
  const base = 'flex w-full items-start gap-2 rounded-[4px] px-2 py-1.5 text-left'
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className={`${base} transition-colors hover:bg-ob-hover`}
    >
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  )
}
