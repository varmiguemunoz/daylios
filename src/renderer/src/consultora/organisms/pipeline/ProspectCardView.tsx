import type { ProspectCard } from '@shared/consultora'
import { money, shortDate } from '../../lib'

interface ProspectCardViewProps {
  card: ProspectCard
  /** Próximo paso vencido (butter). */
  late: boolean
  dragging: boolean
  /** Sombra apricot de «caerá aquí». */
  dropClass: string
  onOpen: () => void
  drag: React.HTMLAttributes<HTMLElement> & { draggable: boolean }
}

/** Tarjeta del tablero: empresa, valor, contacto principal y próximo paso. */
export function ProspectCardView({ card, late, dragging, dropClass, onOpen, drag }: ProspectCardViewProps): React.JSX.Element {
  return (
    <button
      type="button"
      data-card
      onClick={onOpen}
      {...drag}
      className={`rounded-sm bg-surface px-3.5 py-3 text-left transition-[background-color,opacity] hover:bg-surface-raised focus-visible:bg-surface-raised ${
        dragging ? 'opacity-40' : ''
      } ${dropClass}`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-list font-bold">{card.company}</span>
        {card.valueUsd !== null && (
          <span className="shrink-0 text-caption font-bold text-milk-soft tabular-nums">{money(card.valueUsd)}</span>
        )}
      </span>
      {card.contact && <span className="mt-0.5 block truncate text-caption text-milk-soft">{card.contact.name}</span>}
      {card.nextStep && (
        <span className={`mt-1.5 block truncate text-micro font-semibold ${late ? 'text-butter' : 'text-milk-soft'}`}>
          {card.nextStepDate && `${shortDate(card.nextStepDate)} · `}
          {card.nextStep}
        </span>
      )}
    </button>
  )
}
