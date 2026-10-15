import { EMAIL_SECTIONS, SECTIONS, type Section, type SectionLink } from '../sections'
import { useAutomationAlerts } from '../hooks/useAutomationAlerts'

export function SectionNav({
  current,
  onOpen
}: {
  current: Section | null
  onOpen: (id: Section) => void
}): React.JSX.Element {
  const alerts = useAutomationAlerts()
  const row = (s: SectionLink): React.JSX.Element => {
    const badge = s.id === 'automations' ? alerts : 0
    const Icon = s.icon
    const here = s.id === current
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => onOpen(s.id)}
        aria-current={here ? 'page' : undefined}
        className={`flex h-[30px] w-full shrink-0 items-center gap-2.5 rounded-[4px] px-2.5 text-left text-[13px] transition-colors hover:bg-ob-hover hover:text-ob-text ${
          here ? 'bg-ob-active text-ob-text' : 'text-ob-muted'
        }`}
      >
        <Icon size={15} strokeWidth={2} className="shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{s.label}</span>
        {badge > 0 && (
          <span
            title="Con fallos en las últimas 24 h o bloqueadas"
            className="grid h-4 min-w-4 place-items-center rounded-full bg-ob-red/20 px-1 text-[11px] font-semibold text-ob-red tabular-nums"
          >
            {badge}
          </span>
        )}
      </button>
    )
  }

  return (
    <nav aria-label="Secciones" className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
      <p className="px-2.5 pt-1 pb-1.5 text-[12px] font-semibold text-ob-faint">Consultora</p>
      {SECTIONS.map(row)}
      <p className="px-2.5 pt-4 pb-1.5 text-[12px] font-semibold text-ob-faint">Email</p>
      {EMAIL_SECTIONS.map(row)}
    </nav>
  )
}
