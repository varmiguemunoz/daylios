export interface Hlc {
  ms: number

  counter: number

  node: string
}

export const MAX_DRIFT_MS = 5 * 60_000

const MS_DIGITS = 15
const COUNTER_DIGITS = 6

export const encodeHlc = (h: Hlc): string =>
  `${String(h.ms).padStart(MS_DIGITS, '0')}:${String(h.counter).padStart(COUNTER_DIGITS, '0')}:${h.node}`

export function decodeHlc(text: string): Hlc {
  const [ms, counter, ...node] = text.split(':')
  const h = { ms: Number(ms), counter: Number(counter), node: node.join(':') }
  if (!Number.isFinite(h.ms) || !Number.isFinite(h.counter) || !h.node) {
    throw new Error(`Revisión inválida: ${text}`)
  }
  return h
}

export function tick(last: Hlc, now: number): Hlc {
  const ms = Math.max(last.ms, now)
  return { ms, counter: ms === last.ms ? last.counter + 1 : 0, node: last.node }
}

export function receive(last: Hlc, remote: Hlc, now: number): Hlc {
  if (remote.ms - now > MAX_DRIFT_MS) {
    throw new Error('El reloj del otro dispositivo va demasiado adelantado.')
  }
  const ms = Math.max(last.ms, remote.ms, now)
  const counter =
    ms === last.ms && ms === remote.ms
      ? Math.max(last.counter, remote.counter) + 1
      : ms === last.ms
        ? last.counter + 1
        : ms === remote.ms
          ? remote.counter + 1
          : 0
  return { ms, counter, node: last.node }
}

export const newer = (a: string, b: string | null | undefined): boolean => !b || a > b
