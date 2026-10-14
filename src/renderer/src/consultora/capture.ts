export interface Streams {
  display: MediaStream
  mic: MediaStream | null
}

export interface Capture {
  stop: () => Promise<void>
  hasSystemAudio: boolean
  hasMic: boolean
}

export class PermissionError extends Error {}

const TIMEOUT_MS = 15_000
const MIME_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new PermissionError(message)), TIMEOUT_MS)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export async function acquire(): Promise<Streams> {
  let display: MediaStream
  try {
    display = await withTimeout(
      navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: true }),
      'macOS no respondió al pedir la pantalla.'
    )
  } catch (error) {
    if (error instanceof PermissionError) throw error
    throw new PermissionError('macOS no dejó grabar la pantalla.')
  }

  let mic: MediaStream | null = null
  try {
    mic = await withTimeout(
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      }),
      'macOS no respondió al pedir el micrófono.'
    )
  } catch {
    mic = null // sin micrófono se graba solo el sistema
  }

  if (display.getAudioTracks().length === 0 && !mic) {
    release({ display, mic })
    throw new PermissionError('No hay audio: ni del sistema ni del micrófono.')
  }
  return { display, mic }
}

export function release(streams: Streams): void {
  streams.display.getTracks().forEach((t) => t.stop())
  streams.mic?.getTracks().forEach((t) => t.stop())
}

export function record(
  streams: Streams,
  onChunk: (data: Uint8Array) => Promise<void>,

  onEnded: () => void
): Capture {
  const systemAudio = streams.display.getAudioTracks()

  // Mezclar sistema + micrófono en una pista
  const context = new AudioContext()
  const mix = context.createMediaStreamDestination()
  if (systemAudio.length) context.createMediaStreamSource(new MediaStream(systemAudio)).connect(mix)
  if (streams.mic) context.createMediaStreamSource(streams.mic).connect(mix)

  const stream = new MediaStream([
    ...streams.display.getVideoTracks(),
    ...mix.stream.getAudioTracks()
  ])
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
  streams.display.getVideoTracks()[0]?.addEventListener('ended', onEnded)

  recorder.start(5000)

  return {
    hasSystemAudio: systemAudio.length > 0,
    hasMic: streams.mic !== null,
    stop: async () => {
      if (recorder.state !== 'inactive') recorder.stop()
      await stopped
      await queue
      release(streams)
      await context.close()
    }
  }
}
