import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { todayKey } from '@shared/tasks'
import { relativeDay, timeOf } from '../../lib/format'
import { DayHeading } from '../../components/DayHeading'
import { Pager } from '../../components/Pager'
import { api, attempt, useLoad, type Go } from '../lib'
import { Empty, ErrorNote, List, MeetingStatusPill, Page, Row } from '../ui'

/** Todas las reuniones por día (patrón de Historial). «Nueva» = reunión sin grabar, con notas a mano. */
export function Meetings({ go }: { go: Go }): React.JSX.Element {
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => api.listMeetings({ page, pageSize: 10 }), [page])
  const { data, error: loadError } = useLoad(load)
  const refsLoad = useCallback(() => api.refs(), [])
  const { data: refs } = useLoad(refsLoad)
  const today = todayKey()

  const clientName = (id: string | null): string =>
    refs?.clients.find((c) => c.id === id)?.name ?? ''

  const create = async (): Promise<void> => {
    let id = ''
    const failed = await attempt(async () => {
      id = (await api.createMeeting({ title: 'Reunión' })).id
    })
    setError(failed)
    if (!failed) go({ name: 'meeting', id })
  }

  return (
    <Page
      title="Reuniones"
      actions={
        <button
          type="button"
          onClick={() => void create()}
          title="Reunión sin grabar: escribe las notas y pide el resumen"
          className="flex h-9 items-center gap-1.5 rounded-full bg-surface pr-4 pl-3 text-caption font-extrabold text-milk hover:bg-surface-raised"
        >
          <Plus size={16} strokeWidth={3} />
          Sin grabar
        </button>
      }
    >
      <ErrorNote message={error ?? loadError} />
      <div className="mt-6 flex flex-col gap-6">
        {data && data.totalDays === 0 && (
          <Empty
            title="Aún no hay reuniones."
            hint="Pulsa «Grabar» arriba para la próxima llamada, o crea una sin grabar."
          />
        )}
        {data?.days.map((d) => (
          <section key={d.date}>
            <DayHeading>{relativeDay(d.date, today)}</DayHeading>
            <List>
              {d.meetings.map((m) => (
                <Row key={m.id} onClick={() => go({ name: 'meeting', id: m.id })}>
                  <span className="w-12 shrink-0 text-caption font-bold text-milk-soft">
                    {timeOf(m.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-list font-bold">{m.title}</span>
                  <span className="shrink-0 truncate text-caption text-milk-soft">
                    {clientName(m.clientId)}
                  </span>
                  <MeetingStatusPill status={m.status} />
                </Row>
              ))}
            </List>
          </section>
        ))}
      </div>
      {data && (
        <div className="mt-4">
          <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />
        </div>
      )}
    </Page>
  )
}
