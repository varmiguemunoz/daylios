import { useEffect, useRef, useState } from 'react'
import type { Meeting } from '@shared/consultora'
import { errorMessage } from '../lib/api'
import { api, recordingApi, type Go } from './lib'
import { startCapture, type Capture } from './capture'
import { Button, Field, Select } from './ui'

type State =
  | { name: 'idle' }
  | { name: 'starting' }
  | { name: 'recording'; meeting: Meeting; capture: Capture; startedAt: number }
  | { name: 'stopping'; meeting: Meeting; seconds: number }

/**
 * Botón «Grabar» de la barra superior. Grabando: cronómetro + «Detener».
 * Al detener pide título, participantes y asociación (sugerida por el título) y lanza el procesado.
 */
export function Recorder({ go }: { go: Go }): React.JSX.Element {
  const [state, setState] = useState<State>({ name: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const stopRef = useRef<() => void>(() => undefined)

  // Cronómetro: solo corre mientras se graba
  useEffect(() => {
    if (state.name !== 'recording') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [state.name])

  const start = async (): Promise<void> => {
    setError(null)
    setWarning(null)
    setState({ name: 'starting' })
    let meeting: Meeting | null = null
    try {
      meeting = await recordingApi.start()
      const id = meeting.id
      const capture = await startCapture(
        (data) => recordingApi.chunk(id, data),
        () => stopRef.current()
      )
      if (!capture.hasSystemAudio)
        setWarning('Sin audio del sistema: solo se graba tu micrófono (no las voces de los demás).')
      else if (!capture.hasMic) setWarning('Sin micrófono: solo se graba el audio del sistema.')
      const startedAt = Date.now()
      setNow(startedAt)
      setState({ name: 'recording', meeting, capture, startedAt })
    } catch (e) {
      // No se pudo capturar: cerrar el archivo y borrar la reunión vacía
      if (meeting) {
        const id = meeting.id
        await recordingApi.stop(id, emptyInfo(meeting)).catch(() => undefined)
        await api.removeMeeting(id).catch(() => undefined)
      }
      setError(errorMessage(e))
      setState({ name: 'idle' })
    }
  }

  const stop = async (): Promise<void> => {
    if (state.name !== 'recording') return
    const seconds = (Date.now() - state.startedAt) / 1000
    setState({ name: 'stopping', meeting: state.meeting, seconds })
    await state.capture.stop()
  }
  // Mantener la referencia al último stop() para el callback onEnded de la captura.
  useEffect(() => {
    stopRef.current = () => void stop()
  })

  const elapsed =
    state.name === 'recording' ? Math.max(0, Math.floor((now - state.startedAt) / 1000)) : 0

  return (
    <>
      {state.name === 'recording' ? (
        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
          <span className="flex h-9 items-center gap-2 rounded-full bg-rose/15 px-4 text-caption font-extrabold text-rose tabular-nums">
            <span className="size-2 animate-pulse rounded-full bg-rose" aria-hidden />
            {clock(elapsed)}
          </span>
          <Button onClick={() => void stop()}>Detener</Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={state.name !== 'idle'}
          onClick={() => void start()}
          title="Graba pantalla, micrófono y audio del sistema"
          className="flex h-9 items-center gap-2 rounded-full bg-surface pr-4 pl-3.5 text-caption font-extrabold text-milk transition-colors hover:bg-surface-raised disabled:text-milk-faint [-webkit-app-region:no-drag]"
        >
          <span className="size-2.5 rounded-full bg-rose" aria-hidden />
          {state.name === 'starting' ? 'Preparando…' : 'Grabar reunión'}
        </button>
      )}

      {(error || warning) && state.name !== 'stopping' && (
        <p
          role="alert"
          className={`absolute top-14 right-6 z-10 max-w-sm rounded-md px-4 py-3 text-caption ${error ? 'bg-coral/15 text-coral' : 'bg-butter/10 text-butter'}`}
        >
          {error ?? warning}
        </p>
      )}

      {state.name === 'stopping' && (
        <StopSheet
          meeting={state.meeting}
          seconds={state.seconds}
          onDone={(meeting) => {
            setState({ name: 'idle' })
            setWarning(null)
            go({ name: 'meeting', id: meeting.id })
          }}
        />
      )}
    </>
  )
}

/** Hoja al detener: título, participantes y asociación. Guardar lanza transcripción + resumen. */
function StopSheet({
  meeting,
  seconds,
  onDone
}: {
  meeting: Meeting
  seconds: number
  onDone: (meeting: Meeting) => void
}): React.JSX.Element {
  const [title, setTitle] = useState(meeting.title)
  const [participants, setParticipants] = useState('')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [prospectId, setProspectId] = useState('')
  const [refs, setRefs] = useState<Awaited<ReturnType<typeof api.refs>> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void api.refs().then(setRefs)
  }, [])

  /** Sugerencia por título: solo rellena lo que aún está vacío. */
  const suggest = async (): Promise<void> => {
    const s = await api.suggestAssociation(title)
    if (!clientId && s.clientId) setClientId(s.clientId)
    if (!projectId && s.projectId) setProjectId(s.projectId)
    if (!prospectId && s.prospectId) setProspectId(s.prospectId)
  }

  const save = async (): Promise<void> => {
    try {
      onDone(
        await recordingApi.stop(meeting.id, {
          title,
          participants: participants
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean),
          clientId: clientId || null,
          projectId: projectId || null,
          prospectId: prospectId || null,
          durationSec: seconds
        })
      )
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const projects = refs?.projects.filter((p) => !clientId || p.clientId === clientId) ?? []
  const input = 'bg-transparent text-list outline-none'

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-night/75 p-6 [-webkit-app-region:no-drag]">
      <form
        className="toast-in w-full max-w-lg rounded-xl bg-surface p-6 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.7)]"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <h2 className="text-title font-extrabold">Grabación lista</h2>
        <p className="mt-1 text-caption text-milk-soft">
          Al guardar se transcribe y se resume en segundo plano. Te aviso cuando termine.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <Field label="Título">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void suggest()}
              className={input}
            />
          </Field>
          <Field label="Participantes (separados por comas)">
            <input
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="Ana (Acme), Miguel"
              className={input}
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Select
            label="Cliente"
            value={clientId}
            options={[
              { value: '', label: 'Sin cliente' },
              ...(refs?.clients ?? []).map((c) => ({ value: c.id, label: c.name }))
            ]}
            onChange={(id) => {
              setClientId(id)
              setProjectId('')
            }}
          />
          <Select
            label="Proyecto"
            value={projectId}
            options={[
              { value: '', label: 'Sin proyecto' },
              ...projects.map((p) => ({ value: p.id, label: p.name }))
            ]}
            onChange={setProjectId}
          />
          <Select
            label="Prospecto"
            value={prospectId}
            options={[
              { value: '', label: 'Sin prospecto' },
              ...(refs?.prospects ?? []).map((p) => ({ value: p.id, label: p.company }))
            ]}
            onChange={setProspectId}
          />
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-coral/12 px-4 py-3 text-caption text-coral">{error}</p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="h-10 rounded-full bg-apricot px-5 text-caption font-extrabold text-ink active:scale-95"
          >
            Guardar y procesar
          </button>
        </div>
      </form>
    </div>
  )
}

const emptyInfo = (meeting: Meeting): Parameters<typeof recordingApi.stop>[1] => ({
  title: meeting.title,
  participants: [],
  clientId: null,
  projectId: null,
  prospectId: null,
  durationSec: 0
})

/** 754 → "12:34" */
const clock = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return h ? `${h}:${m}:${s}` : `${m}:${s}`
}
