import { mkdirSync, mkdtempSync, renameSync } from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import type { DataSource } from 'typeorm'
import { setTrash } from '../services/trash'
import { Vault } from '../services/vault'
import { WorkspaceService } from '../services/workspace.service'
import { memoryDb } from './helpers'

/** Bóveda en una carpeta temporal, base en memoria y Papelera falsa (mueve a `<tmp>/.trash`). */
export async function tempWorkspace(): Promise<{
  db: DataSource
  root: string
  workspace: WorkspaceService
}> {
  const base = mkdtempSync(join(tmpdir(), 'daylios-vault-'))
  const root = join(base, 'vault')
  const trash = join(base, 'trash')
  mkdirSync(root)
  mkdirSync(trash)
  setTrash(async (path) => renameSync(path, join(trash, `${Date.now()}-${basename(path)}`)))
  const db = await memoryDb()
  const workspace = new WorkspaceService(db, new Vault(() => root))
  return { db, root, workspace }
}
