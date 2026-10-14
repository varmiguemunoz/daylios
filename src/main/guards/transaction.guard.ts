import type { DataSource, EntityManager } from 'typeorm'

let queue: Promise<unknown> = Promise.resolve()

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

export function afterCommit(manager: EntityManager, fn: () => void): void {
  const list = pending.get(manager)
  if (list) list.push(fn)
  else fn()
}
