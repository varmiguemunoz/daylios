import { useCallback, useEffect, useState } from 'react'
import { errorMessage, onDataChanged } from '../lib/api'

/** Puente a main para la Consultora (ver src/preload). */
export const api = window.api.consultora
export const recordingApi = window.api.recording
export const openPath = window.api.openPath

/** Pantallas de la ventana. Sin router: una pila de pantallas (Atrás = quitar la última). */
export type Screen =
  | { name: 'clients' }
  | { name: 'client'; id: string }
  | { name: 'project'; id: string }
  | { name: 'meetings' }
  | { name: 'meeting'; id: string }
  | { name: 'pipeline' }
  | { name: 'prospect'; id: string }
  | { name: 'contacts' }
  | { name: 'contact'; id: string }
  | { name: 'settings' }
  | { name: 'search'; query: string }

export type Go = (screen: Screen) => void

/**
 * Carga datos y los recarga cuando algo cambia (Claude, grabación u otra pantalla).
 * `load` debe ser estable (useCallback) o se recargará en cada render.
 */
export function useLoad<T>(load: () => Promise<T>): {
  data: T | null
  error: string | null
  reload: () => Promise<void>
} {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setData(await load())
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [load])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState solo tras await (async)
    void reload()
    return onDataChanged(() => void reload())
  }, [reload])

  return { data, error, reload }
}

/**
 * Ejecuta una escritura y devuelve el mensaje de error (o null). Las pantallas recargan solas
 * porque main avisa `data:changed` tras cada escritura.
 */
export async function attempt(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (e) {
    return errorMessage(e)
  }
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
})
const dayFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
})

export const money = (n: number | null): string => (n === null ? '—' : usd.format(n))

/** "2 oct 2026" para fechas YYYY-MM-DD o ISO. */
export const shortDate = (value: string | null): string => {
  if (!value) return '—'
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value)
  return dayFmt.format(date).replace('.', '')
}

/** "vie, 2 oct, 10:15" */
export const dateTime = (iso: string): string =>
  dateTimeFmt.format(new Date(iso)).replace(/\./g, '')

/** "1 h 05 min" */
export const duration = (seconds: number | null): string => {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

export const bytes = (n: number): string =>
  n < 1024
    ? `${n} B`
    : n < 1024 ** 2
      ? `${Math.round(n / 1024)} KB`
      : `${(n / 1024 ** 2).toFixed(1)} MB`
