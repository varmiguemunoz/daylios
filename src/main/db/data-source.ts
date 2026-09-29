import { join } from 'path'
import { DataSource } from 'typeorm'
import { TaskModel } from '../models/task.model'
import { CreateTasks1727600000000 } from './migrations/CreateTasks'

/** Abre `daylios.db` en la carpeta de datos de la app y aplica las migraciones pendientes. */
export async function openDatabase(dir: string): Promise<DataSource> {
  const db = new DataSource({
    type: 'better-sqlite3',
    database: join(dir, 'daylios.db'),
    entities: [TaskModel],
    migrations: [CreateTasks1727600000000],
    migrationsRun: true,
    synchronize: false
  })
  return db.initialize()
}
