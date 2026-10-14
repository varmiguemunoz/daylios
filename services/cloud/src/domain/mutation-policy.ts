import { MAX_DRIFT_MS, decodeHlc } from '@shared/hlc'
import { SYNC_TABLES, isNeverSynced } from '@shared/edition'
import type { Mutation } from '@shared/sync-merge'

const MAX_ID = 128
const MAX_FIELDS = 64

/**
 * Valida una mutación antes de aplicarla. Devuelve el motivo del rechazo o null si vale.
 * Nunca acepta tablas ni columnas de la lista de lo que no se sincroniza.
 */
export function rejectReason(m: Mutation, now: number): string | null {
  if (!m || typeof m !== 'object') return 'Mutación vacía.'
  if (!(SYNC_TABLES as readonly string[]).includes(m.entity)) {
    return `Tabla no sincronizable: ${String(m.entity)}.`
  }
  if (typeof m.id !== 'string' || !m.id || m.id.length > MAX_ID) return 'Id inválido.'
  if (m.op !== 'upsert' && m.op !== 'delete') return 'Operación desconocida.'
  if (!m.fields || typeof m.fields !== 'object') return 'Campos inválidos.'
  const keys = Object.keys(m.fields)
  if (keys.length > MAX_FIELDS) return 'Demasiados campos.'
  const blocked = keys.find(
    (k) => isNeverSynced(m.entity, k) || ['org_id', 'updated_by', 'rev'].includes(k)
  )
  if (blocked) return `Campo que no se sincroniza: ${blocked}.`
  try {
    if (decodeHlc(m.rev).ms - now > MAX_DRIFT_MS) return 'Reloj del dispositivo adelantado.'
  } catch {
    return 'Revisión inválida.'
  }
  return null
}
