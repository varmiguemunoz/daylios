import type { ProspectCard } from '@shared/consultora'
import { money, shortDate } from '../../lib'
import { freshClass, useFresh } from '../live/RemoteChanges'

interface ProspectCardViewProps {
  card: ProspectCard

  late: boolean
  dragging: boolean

  dropClass: string
  onOpen: () => void
  drag: React.HTMLAttributes<HTMLElement> & { draggable: boolean }
}

export function ProspectCardView({
  card,
  late,
  dragging,
  dropClass,
  onOpen,
  drag
}: ProspectCardViewProps): React.JSX.Element {
  const fresh = useFresh('prospects')
  return (
    <button
      type="button"
      data-card
      onClick={onOpen}
      {...drag}
      className={`rounded-[6px] border border-ob-border bg-ob-bg px-3 py-2.5 text-left transition-[border-color,opacity] hover:border-[#4a4a4a] focus-visible:border-ob-accent ${
        dragging ? 'opacity-40' : ''
      } ${dropClass} ${freshClass(fresh(card.id))}`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[14px] text-ob-text">{card.company}</span>
        {card.valueUsd !== null && (
          <span className="shrink-0 text-[12px] text-ob-muted tabular-nums">
            {money(card.valueUsd)}
          </span>
        )}
      </span>
      {card.contact && (
        <span className="mt-0.5 block truncate text-[13px] text-ob-muted">{card.contact.name}</span>
      )}
      {card.nextStep && (
        <span
          className={`mt-1.5 block truncate text-[12px] ${late ? 'text-ob-yellow' : 'text-ob-faint'}`}
        >
          {card.nextStepDate && `${shortDate(card.nextStepDate)} · `}
          {card.nextStep}
        </span>
      )}
    </button>
  )
}
