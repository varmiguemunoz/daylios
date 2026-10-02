/**
 * Captura de reunión en el renderer: pantalla + audio del sistema (lo da main con 'loopback')
 * + micrófono, mezclados en una sola pista. MediaRecorder entrega un trozo WebM cada 5 s
 * y `onChunk` lo manda a main, que lo escribe en disco. Nada grande queda en memoria.
 */

export interface Capture {
  /** Para la grabación y espera a que el último trozo llegue a main. */
  stop: () => Promise<void>
  hasSystemAudio: boolean
  hasMic: boolean
}

const MIME_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']

export async function startCapture(
  onChunk: (data: Uint8Array) => Promise<void>,
  /** El usuario dejó de compartir pantalla desde macOS. */
  onEnded: () => void
): Promise<Capture> {
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 15 },
    audio: true
  })

  let mic: MediaStream | null = null
  try {
    mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    })
  } catch {
    mic = null // sin permiso de micrófono: se graba solo el sistema
  }

  const systemAudio = display.getAudioTracks()
  const stopTracks = (): void => {
    display.getTracks().forEach((t) => t.stop())
    mic?.getTracks().forEach((t) => t.stop())
  }

  if (systemAudio.length === 0 && !mic) {
    stopTracks()
    throw new Error(
      'No hay audio: ni del sistema ni del micrófono. Revisa los permisos en Ajustes del Sistema.'
    )
  }

  // Mezclar sistema + micrófono en una pista
  const context = new AudioContext()
  const mix = context.createMediaStreamDestination()
  if (systemAudio.length) context.createMediaStreamSource(new MediaStream(systemAudio)).connect(mix)
  if (mic) context.createMediaStreamSource(mic).connect(mix)

  const stream = new MediaStream([...display.getVideoTracks(), ...mix.stream.getAudioTracks()])
  const recorder = new MediaRecorder(stream, {
    mimeType: MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)),
    videoBitsPerSecond: 1_200_000,
    audioBitsPerSecond: 96_000
  })

  // Encolar los envíos para que lleguen a main en orden
  let queue: Promise<void> = Promise.resolve()
  recorder.ondataavailable = (event) => {
    if (event.data.size === 0) return
    queue = queue.then(async () => onChunk(new Uint8Array(await event.data.arrayBuffer())))
  }
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()))
  display.getVideoTracks()[0]?.addEventListener('ended', onEnded)

  recorder.start(5000)

  return {
    hasSystemAudio: systemAudio.length > 0,
    hasMic: mic !== null,
    stop: async () => {
      if (recorder.state !== 'inactive') recorder.stop()
      await stopped
      await queue
      stopTracks()
      await context.close()
    }
  }
}
