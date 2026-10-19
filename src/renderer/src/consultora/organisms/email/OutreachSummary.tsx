import type { OutreachStatus } from '@shared/marketing'
import { dateTime } from '../../lib'

export function OutreachSummary({ status }: { status: OutreachStatus }): React.JSX.Element {
  const items = [
    { label: 'Proveedor', value: status.label ?? 'Sin asignar' },
    { label: 'Inscritos hoy', value: `${status.sentToday} de ${status.dailyCap}` },
    { label: 'Quedan hoy', value: String(status.remainingToday) },
    {
      label: 'Respuestas',
      value: status.lastPollAt ? `Revisadas ${dateTime(status.lastPollAt)}` : 'Sin revisar aún'
    }
  ]
  return (
    <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-[6px] border border-ob-border px-3 py-2">
          <p className="text-caption text-ob-muted">{item.label}</p>
          <p className="truncate text-[15px] text-ob-text">{item.value}</p>
        </div>
      ))}
    </div>
  )
}
