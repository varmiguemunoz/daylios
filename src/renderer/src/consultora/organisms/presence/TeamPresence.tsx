import { sameView, type PresenceView } from '@shared/presence'
import { PresenceStack } from '../../molecules/PresenceStack'
import { usePresence, usePresenceReporter } from './usePresence'

const firstName = (name: string | null): string => (name ?? 'Alguien').split(/\s+/)[0]

const join = (names: string[]): string =>
  names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`

export function TeamPresence({ view }: { view: PresenceView | null }): React.JSX.Element | null {
  usePresenceReporter(view)
  const { enabled, members } = usePresence()
  if (!enabled || !members.length) return null
  const here = members.filter((m) => sameView(m.view, view))
  const editing = here.filter((m) => m.editing)
  const note = editing.length
    ? `${join(editing.map((m) => firstName(m.name)))} ${editing.length > 1 ? 'están' : 'está'} editando`
    : here.length
      ? `${join(here.map((m) => firstName(m.name)))} también ${here.length > 1 ? 'están' : 'está'} aquí`
      : null

  return (
    <div className="flex items-center gap-2 pr-1">
      {note && (
        <span
          role="status"
          className={`max-w-[200px] truncate rounded-full px-2 py-0.5 text-[11px] ${
            editing.length ? 'bg-ob-yellow/15 text-ob-yellow' : 'bg-ob-active text-ob-muted'
          }`}
        >
          {note}
        </span>
      )}
      <PresenceStack members={members} here={new Set(here.map((m) => m.userId))} />
    </div>
  )
}
