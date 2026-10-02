import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

/** Máximo por nota de voz. Al llegar, se para sola. */
const MAX_SECONDS = 600

type State =
  | { name: 'idle' }
  | { name: 'listening'; startedAt: number }
  | { name: 'working' }
  | { name: 'done'; title: string }
  | { name: 'error'; message: string }

/**
 * Pastilla flotante de la nota de voz (ventana `?window=voice`).
 * main avisa `voice:start` / `voice:stop`; aquí se graba el micrófono (WebM/Opus)
 * y al terminar se manda el audio a main, que transcribe y crea la nota.
 */
export function VoicePill(): React.JSX.Element | null {
  const [state, setState] = useState<State>({ name: 'idle' })
  const [now, setNow] = useState(Date.now())
  const recorder = useRef<MediaRecorder | null>(null)
  const stopRequested = useRef(false)

  // Fondo transparente: solo se ve la pastilla.
  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
  }, [])

  useEffect(() => {
    const hideLater = (ms: number): void => {
      window.setTimeout(() => {
        setState({ name: 'idle' })
        window.api.voice.hide()
      }, ms)
    }

    const start = async (): Promise<void> => {
      if (recorder.current) return
      stopRequested.current = false
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      } catch {
        setState({ name: 'error', message: 'Sin permiso de micrófono' })
        hideLater(2500)
        return
      }

      const chunks: Blob[] = []
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32_000 })
      const startedAt = Date.now()
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        recorder.current = null
        const seconds = (Date.now() - startedAt) / 1000
        setState({ name: 'working' })
        const audio = new Uint8Array(await new Blob(chunks, { type: 'audio/webm' }).arrayBuffer())
        const result = await window.api.voice.finish(audio, seconds)
        if (result.status === 'created') {
          setState({ name: 'done', title: result.title })
          hideLater(1600)
        } else if (result.status === 'failed') {
          setState({ name: 'error', message: 'No se pudo transcribir. Reintenta en Ajustes.' })
          hideLater(3500)
        } else {
          hideLater(0)
        }
      }
      recorder.current = rec
      rec.start(1000)
      setNow(startedAt)
      setState({ name: 'listening', startedAt })
      // Si se soltó el atajo mientras macOS daba el micrófono, parar ya.
      if (stopRequested.current) rec.stop()
    }

    const stop = (): void => {
      stopRequested.current = true
      if (recorder.current?.state === 'recording') recorder.current.stop()
    }

    const offStart = window.api.voice.onStart(() => void start())
    const offStop = window.api.voice.onStop(stop)
    return () => {
      offStart()
      offStop()
    }
  }, [])

  // Cronómetro y tope de 10 min
  useEffect(() => {
    if (state.name !== 'listening') return
    const timer = window.setInterval(() => {
      setNow(Date.now())
      if ((Date.now() - state.startedAt) / 1000 >= MAX_SECONDS && recorder.current?.state === 'recording') {
        recorder.current.stop()
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [state])

  if (state.name === 'idle') return null

  const seconds = state.name === 'listening' ? Math.floor((now - state.startedAt) / 1000) : 0

  return (
    <div className="flex h-full items-center justify-center p-2">
      <div className="toast-in flex h-11 max-w-full items-center gap-2.5 rounded-full bg-surface-raised pr-5 pl-4 text-caption font-bold shadow-[0_10px_30px_-8px_rgb(0_0_0/0.7)]">
        {state.name === 'listening' && (
          <>
            <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-rose" aria-hidden />
            <span className="text-milk">Escuchando</span>
            <span className="text-milk-soft tabular-nums">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </span>
          </>
        )}
        {state.name === 'working' && <span className="text-apricot">Escribiendo la nota…</span>}
        {state.name === 'done' && (
          <>
            <Check size={16} strokeWidth={3} className="shrink-0 text-mint" />
            <span className="truncate text-milk">{state.title}</span>
          </>
        )}
        {state.name === 'error' && <span className="text-coral">{state.message}</span>}
      </div>
    </div>
  )
}
