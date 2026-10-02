import { useEffect, useRef, useState } from 'react'
import type { Meeting } from '@shared/consultora'
import { errorMessage } from '../lib/api'
import { recordingApi, type Go } from './lib'
import { acquire, PermissionError, record, release, type Capture, type Streams } from './capture'
import { Button } from './ui'
import { MeetingSheet } from './MeetingSheet'

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
  const [help, setHelp] = useState<'screen' | 'microphone' | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const stopRef = useRef<() => void>(() => undefined)

  // Cronómetro: solo corre mientras se graba
  useEffect(() => {
    if (state.name !== 'recording') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [state.name])

  /**
   * 1. Micrófono  2. Pantalla + micro  3. Crear la reunión  4. Grabar.
   * Si falla 2 no se crea nada (no quedan reuniones rotas) y se muestra cómo dar el permiso.
   */
  const start = async (): Promise<void> => {
    setError(null)
    setWarning(null)
    setHelp(null)
    setState({ name: 'starting' })

    // Pide el micrófono si nunca se pidió. La pantalla no se pre-comprueba: macOS dice «denied»
    // también cuando aún no la ha pedido, y solo la pide (y añade la app a la lista) al intentarlo.
    await window.api.permissions.check()

    let streams: Streams
    try {
      streams = await acquire()
    } catch (e) {
      if (e instanceof PermissionError) setHelp(e.message.startsWith('No hay audio') ? 'microphone' : 'screen')
      else setError(errorMessage(e))
      setState({ name: 'idle' })
      return
    }

    try {
      const meeting = await recordingApi.start()
      const capture = record(
        streams,
        (data) => recordingApi.chunk(meeting.id, data),
        () => stopRef.current()
      )
      if (!capture.hasSystemAudio) setWarning('Sin audio del sistema: solo se graba tu micrófono (no las voces de los demás).')
      else if (!capture.hasMic) setWarning('Sin micrófono: solo se graba el audio del sistema.')
      const startedAt = Date.now()
      setNow(startedAt)
      setState({ name: 'recording', meeting, capture, startedAt })
    } catch (e) {
      release(streams)
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

      {help && state.name === 'idle' && <PermissionHelp kind={help} onClose={() => setHelp(null)} />}

      {(error || warning) && state.name !== 'stopping' && !help && (
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

/**
 * Falta un permiso de macOS. Pasos: activar el interruptor en Ajustes del Sistema y reiniciar
 * (macOS solo aplica la Grabación de pantalla después de reiniciar la app).
 */
function PermissionHelp({ kind, onClose }: { kind: 'screen' | 'microphone'; onClose: () => void }): React.JSX.Element {
  const [restarting, setRestarting] = useState(false)
  const what = kind === 'screen' ? 'Grabación de pantalla y audio del sistema' : 'Micrófono'
  return (
    <div
      role="alert"
      className="toast-in absolute top-14 right-6 z-10 w-[380px] rounded-lg bg-surface-raised p-5 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.7)] [-webkit-app-region:no-drag]"
    >
      <p className="text-list font-extrabold">Falta el permiso de {what}</p>
      <ol className="mt-2 list-decimal pl-5 text-caption text-milk-soft">
        <li>Abre Ajustes del Sistema y activa <span className="font-bold text-milk">daily-os</span>. Si ya estaba activo, desactívalo y vuelve a activarlo.</li>
        <li>Reinicia DayliOS: macOS solo aplica el permiso al volver a abrir la app.</li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button kind="primary" onClick={() => void window.api.permissions.open(kind)}>
          Abrir Ajustes del Sistema
        </Button>
        <Button
          disabled={restarting}
          onClick={() => {
            setRestarting(true)
            void window.api.permissions.restartApp()
          }}
        >
          {restarting ? 'Reiniciando…' : 'Reiniciar DayliOS'}
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </div>
      {restarting && <p className="mt-3 text-caption text-milk-soft">Se vuelve a abrir sola en unos segundos.</p>}
    </div>
  )
}

/** Hoja al detener: título, participantes, asociación e idioma. Guardar lanza transcripción + resumen. */
function StopSheet({
  meeting,
  seconds,
  onDone
}: {
  meeting: Meeting
  seconds: number
  onDone: (meeting: Meeting) => void
}): React.JSX.Element {
  return (
    <MeetingSheet
      heading="Grabación lista"
      hint="Al guardar se transcribe y se resume en segundo plano. Te aviso cuando termine."
      defaultTitle={meeting.title}
      submitLabel="Guardar y procesar"
      onSubmit={async (info) => onDone(await recordingApi.stop(meeting.id, { ...info, durationSec: seconds }))}
    />
  )
}

/** 754 → "12:34" */
const clock = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return h ? `${h}:${m}:${s}` : `${m}:${s}`
}
