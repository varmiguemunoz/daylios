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
 * Botón «Grabar» de la franja superior. Grabando: REC con cronómetro y «Detener».
 * Al detener pide título, participantes y asociación (sugerida por el título) y lanza el procesado.
 */
export function Recorder({
  go,
  onStateChange
}: {
  go: Go
  /** Avisa del estado (el workspace muestra «REC» y la ventana sabe cuándo mostrar la hoja de guardado). */
  onStateChange?: (state: State['name']) => void
}): React.JSX.Element {
  const [state, setState] = useState<State>({ name: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [help, setHelp] = useState<'screen' | 'microphone' | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const stopRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    onStateChange?.(state.name)
  }, [state.name, onStateChange])

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
      if (e instanceof PermissionError)
        setHelp(e.message.startsWith('No hay audio') ? 'microphone' : 'screen')
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
      if (!capture.hasSystemAudio)
        setWarning('Sin audio del sistema: solo se graba tu micrófono (no las voces de los demás).')
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
        <div className="flex items-center gap-1">
          <span className="flex h-6 items-center gap-1.5 px-1.5 text-[12px] font-semibold text-ob-red tabular-nums">
            <span className="size-1.5 animate-pulse rounded-full bg-ob-red" aria-hidden />
            REC {clock(elapsed)}
          </span>
          <button
            type="button"
            onClick={() => void stop()}
            className="h-6 rounded-[4px] bg-ob-active px-2 text-[12px] text-ob-text transition-colors hover:bg-[#3f3f3f]"
          >
            Detener
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={state.name !== 'idle'}
          onClick={() => void start()}
          title="Grabar reunión: pantalla, micrófono y audio del sistema"
          className="flex h-6 items-center gap-1.5 rounded-[4px] px-2 text-[12px] text-ob-muted transition-colors hover:bg-ob-hover hover:text-ob-text disabled:text-ob-faint"
        >
          <span className="size-2 rounded-full bg-ob-red" aria-hidden />
          {state.name === 'starting' ? 'Preparando…' : 'Grabar'}
        </button>
      )}

      {help && state.name === 'idle' && (
        <PermissionHelp kind={help} onClose={() => setHelp(null)} />
      )}

      {(error || warning) && state.name !== 'stopping' && !help && (
        <p
          role="alert"
          className={`absolute top-[44px] right-3 z-40 max-w-sm rounded-[6px] border border-ob-border bg-ob-alt px-3 py-2 text-[13px] shadow-float ${error ? 'text-ob-red' : 'text-ob-yellow'}`}
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
function PermissionHelp({
  kind,
  onClose
}: {
  kind: 'screen' | 'microphone'
  onClose: () => void
}): React.JSX.Element {
  const [restarting, setRestarting] = useState(false)
  const what = kind === 'screen' ? 'Grabación de pantalla y audio del sistema' : 'Micrófono'
  return (
    <div
      role="alert"
      className="toast-in absolute top-[44px] right-3 z-40 w-[380px] rounded-[8px] border border-ob-border bg-ob-alt p-4 shadow-float"
    >
      <p className="text-[14px] font-semibold text-ob-text">Falta el permiso de {what}</p>
      <ol className="mt-2 list-decimal pl-5 text-[13px] text-ob-muted">
        <li>
          Abre Ajustes del Sistema y activa{' '}
          <span className="font-semibold text-ob-text">daily-os</span>. Si ya estaba activo,
          desactívalo y vuelve a activarlo.
        </li>
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
      {restarting && (
        <p className="mt-3 text-[13px] text-ob-muted">Se vuelve a abrir sola en unos segundos.</p>
      )}
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
      onSubmit={async (info) =>
        onDone(await recordingApi.stop(meeting.id, { ...info, durationSec: seconds }))
      }
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
