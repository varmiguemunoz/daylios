import { useCallback, useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { todayKey } from '@shared/tasks'
import { relativeDay, timeOf } from '../../lib/format'
import { DayHeading } from '../../components/DayHeading'
import { Pager } from '../../components/Pager'
import { api, attempt, useLoad, type Go } from '../lib'
import { Empty, ErrorNote, List, MeetingStatusPill, Page, Row } from '../ui'
import { MeetingSheet } from '../MeetingSheet'

/**
 * Todas las reuniones por día (patrón de Historial).
 * «Subir grabación» (o soltar un video/audio en la pantalla) = transcribir una reunión ya grabada.
 * «Sin grabar» = reunión con notas a mano.
 */
export function Meetings({ go }: { go: Go }): React.JSX.Element {
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => api.listMeetings({ page, pageSize: 10 }), [page])
  const { data, error: loadError } = useLoad(load)
  const refsLoad = useCallback(() => api.refs(), [])
  const { data: refs } = useLoad(refsLoad)
  const today = todayKey()
  const [file, setFile] = useState<string | null>(null) // grabación elegida, esperando la hoja
  const [dropping, setDropping] = useState(false)

  const pick = async (): Promise<void> => {
    const path = await api.pickRecording()
    if (path) setFile(path)
  }

  const fileName = file?.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''

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
    <div
      className="relative h-full"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDropping(true)
      }}
      onDragLeave={(e) => e.target === e.currentTarget && setDropping(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDropping(false)
        const dropped = e.dataTransfer.files[0]
        if (dropped) setFile(window.api.pathForFile(dropped))
      }}
    >
    <Page
      title="Reuniones"
      actions={
        <>
        <button
          type="button"
          onClick={() => void pick()}
          title="Transcribe una reunión ya grabada (mp4, mov, mkv, webm, mp3, m4a, wav)"
          className="flex h-9 items-center gap-1.5 rounded-full bg-apricot pr-4 pl-3 text-caption font-extrabold text-ink transition-transform active:scale-95"
        >
          <Upload size={15} strokeWidth={3} />
          Subir grabación
        </button>
        <button
          type="button"
          onClick={() => void create()}
          title="Reunión sin grabar: escribe las notas y pide el resumen"
          className="flex h-9 items-center gap-1.5 rounded-full bg-surface pr-4 pl-3 text-caption font-extrabold text-milk hover:bg-surface-raised"
        >
          <Plus size={16} strokeWidth={3} />
          Sin grabar
        </button>
        </>
      }
    >
      <ErrorNote message={error ?? loadError} />
      <div className="mt-6 flex flex-col gap-6">
        {data && data.totalDays === 0 && (
          <Empty
            title="Aún no hay reuniones."
            hint="Graba la próxima llamada con «Grabar», sube una ya grabada o crea una sin grabar."
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

      {dropping && (
        <div className="pointer-events-none absolute inset-4 grid place-items-center rounded-xl bg-night/80 shadow-[inset_0_0_0_2px_var(--color-apricot)]">
          <p className="text-label font-extrabold text-apricot">Suelta el video o audio para transcribirlo</p>
        </div>
      )}

      {file && (
        <MeetingSheet
          heading="Subir grabación"
          hint={`${file.split('/').pop()} · se copia a la carpeta de documentos (el original no se toca), se transcribe y se resume.`}
          defaultTitle={fileName}
          submitLabel="Transcribir"
          onCancel={() => setFile(null)}
          onSubmit={async (info) => {
            const meeting = await api.importRecording(file, info)
            setFile(null)
            go({ name: 'meeting', id: meeting.id })
          }}
        />
      )}
    </div>
  )
}
