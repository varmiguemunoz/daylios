import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { DataSource } from 'typeorm'
import { openAt } from '../db/data-source'
import { loadConfig, saveSettings } from '../config'

/** Base SQLite en memoria con todas las migraciones reales aplicadas. */
export function memoryDb(): Promise<DataSource> {
  return openAt(':memory:')
}

/**
 * Ajustes aislados en una carpeta temporal (settings.json y carpeta de clientes),
 * para que ningún test escriba en la carpeta real del usuario.
 */
export function isolatedConfig(): string {
  const dir = mkdtempSync(join(tmpdir(), 'daylios-test-'))
  loadConfig(dir)
  saveSettings({ docsPath: join(dir, 'clientes') })
  return dir
}
