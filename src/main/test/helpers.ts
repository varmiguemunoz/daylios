import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { DataSource } from 'typeorm'
import { openAt } from '../db/data-source'
import { loadConfig, saveSettings } from '../config'

export function memoryDb(): Promise<DataSource> {
  return openAt(':memory:')
}

export function isolatedConfig(): string {
  const dir = mkdtempSync(join(tmpdir(), 'daylios-test-'))
  loadConfig(dir)
  saveSettings({ docsPath: join(dir, 'clientes') })
  return dir
}
