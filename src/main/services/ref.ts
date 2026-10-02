import type { FindOptionsWhere, Repository } from 'typeorm'
import { normalizeName } from '@shared/consultora'
import { AppError } from './app.error'

/**
 * Busca una fila por id o por nombre (sin mayúsculas ni acentos).
 * Primero coincidencia exacta; si no hay, «contiene». Varias coincidencias = error con candidatos.
 * Así Claude puede decir "Acme" en vez de un uuid.
 */
export async function findByRef<T extends { id: string }>(
  repo: Repository<T>,
  ref: unknown,
  field: keyof T & string,
  label: string
): Promise<T> {
  if (typeof ref !== 'string' || !ref.trim()) throw new AppError('invalid', `Indica ${label}.`)

  const byId = await repo.findOneBy({ id: ref } as FindOptionsWhere<T>)
  if (byId) return byId

  const wanted = normalizeName(ref)
  const all = await repo.find()
  const name = (row: T): string => normalizeName(String(row[field] ?? ''))
  const exact = all.filter((row) => name(row) === wanted)
  const matches = exact.length ? exact : all.filter((row) => name(row).includes(wanted))

  if (matches.length === 1) return matches[0]
  if (matches.length === 0) throw new AppError('not_found', `No encontré ${label} «${ref}».`)
  const options = matches.map((row) => `${String(row[field])} (${row.id})`).join(', ')
  throw new AppError(
    'invalid',
    `«${ref}» coincide con varios: ${options}. Usa el nombre completo o el id.`
  )
}
