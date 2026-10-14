import type { DataSource } from 'typeorm'

let author: string | null = null
let syncing = 0

export const setAuthor = (userId: string | null): void => {
  author = userId
}

export async function withoutChangeLog<T>(work: () => Promise<T>): Promise<T> {
  syncing++
  try {
    return await work()
  } finally {
    syncing--
  }
}

interface SqliteConnection {
  function(name: string, options: { deterministic: boolean }, fn: () => unknown): void
}

export function registerAuthorFunction(db: DataSource): void {
  const connection = (db.driver as unknown as { databaseConnection: SqliteConnection })
    .databaseConnection
  connection.function('daylios_author', { deterministic: false }, () => author)
  connection.function('daylios_syncing', { deterministic: false }, () => (syncing > 0 ? 1 : 0))
}
