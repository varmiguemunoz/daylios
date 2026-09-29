import type { DataSource, EntityManager } from 'typeorm'

/**
 * Guard de transacciones.
 */
let queue: Promise<unknown> = Promise.resolve()

export function transactionGuard<T>(
  db: DataSource,
  work: (manager: EntityManager) => Promise<T>
): Promise<T> {
  const run = (): Promise<T> => db.transaction(work)
  const result = queue.then(run, run)
  queue = result.catch(() => undefined)
  return result
}
