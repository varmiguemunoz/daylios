import { useCallback, useEffect, useState } from 'react'
import { errorMessage, onDataChanged } from '../lib/api'

export const api = window.api.consultora
export const recordingApi = window.api.recording
export const openPath = window.api.openPath

export type Screen =
  | { name: 'workspace'; folder: string | null }
  | { name: 'ws-note'; id: string }
  | { name: 'ws-board'; id: string }
  | { name: 'ws-image'; id: string }
  | { name: 'home' }
  | { name: 'tasks'; task?: string }
  | { name: 'clients' }
  | { name: 'client'; id: string }
  | { name: 'project'; id: string }
  | { name: 'meetings' }
  | { name: 'meeting'; id: string }
  | { name: 'pipeline' }
  | { name: 'prospect'; id: string }
  | { name: 'tags' }
  | { name: 'contacts' }
  | { name: 'contact'; id: string }
  | { name: 'automations' }
  | { name: 'automation'; id: string }
  | { name: 'sources' }
  | { name: 'sequences' }
  | { name: 'newsletters' }
  | { name: 'note'; id: string }
  | { name: 'document'; client: string; path: string }
  | { name: 'settings' }
  | { name: 'search'; query: string }

export type Go = (screen: Screen) => void

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

export const shortDate = (value: string | null): string => {
  if (!value) return '—'
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value)
  return dayFmt.format(date).replace('.', '')
}

export const dateTime = (iso: string): string =>
  dateTimeFmt.format(new Date(iso)).replace(/\./g, '')

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

const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z/g

export const humanize = (message: string): string => message.replace(ISO, (iso) => dateTime(iso))
