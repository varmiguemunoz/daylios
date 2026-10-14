import { isDayKey } from '@shared/tasks'
import { AppError } from './app.error'

const MAX_MD = 100_000

export function requiredText(value: unknown, label: string, max = 200): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new AppError('invalid', `${label} no puede estar vacío.`)
  if (text.length > max)
    throw new AppError('invalid', `${label} no puede pasar de ${max} caracteres.`)
  return text
}

export function optionalText(value: unknown, label: string, max = 300): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new AppError('invalid', `${label} debe ser texto.`)
  const text = value.trim()
  if (text.length > max)
    throw new AppError('invalid', `${label} no puede pasar de ${max} caracteres.`)
  return text || null
}

export function markdown(value: unknown, label: string): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'string') throw new AppError('invalid', `${label} debe ser texto.`)
  if (value.length > MAX_MD) throw new AppError('invalid', `${label} es demasiado largo.`)
  return value
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T
  throw new AppError('invalid', `${label} debe ser: ${allowed.join(', ')}.`)
}

export function optionalDay(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null
  if (!isDayKey(value)) throw new AppError('invalid', `${label} debe tener formato YYYY-MM-DD.`)
  return value
}

export function optionalAmount(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0)
    throw new AppError('invalid', `${label} debe ser un número positivo.`)
  return n
}

export const now = (): string => new Date().toISOString()

export function optionalUserId(value: unknown, label = 'El responsable'): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new AppError('invalid', `${label} no es válido.`)
  }
  return value.toLowerCase()
}
