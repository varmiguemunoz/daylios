import type { DataSource, EntityManager } from 'typeorm'

/**
 * Guard de transacciones: serializa las escrituras y revierte todo si algo falla.
 */
let queue: Promise<unknown> = Promise.resolve()

/** Callbacks pendientes por transacción abierta (se ejecutan solo si confirma). */
const pending = new WeakMap<EntityManager, (() => void)[]>()

export function transactionGuard<T>(
  db: DataSource,
  work: (manager: EntityManager) => Promise<T>
): Promise<T> {
  const run = async (): Promise<T> => {
    const callbacks: (() => void)[] = []
    const result = await db.transaction((manager) => {
      pending.set(manager, callbacks)
      return work(manager)
    })
    for (const fn of callbacks) fn()
    return result
  }
  const result = queue.then(run, run)
  queue = result.catch(() => undefined)
  return result
}

/** Ejecuta `fn` cuando la transacción de `manager` confirme (o ya, si no hay transacción del guard). */
export function afterCommit(manager: EntityManager, fn: () => void): void {
  const list = pending.get(manager)
  if (list) list.push(fn)
  else fn()
}
