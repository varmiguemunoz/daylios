import { EntitySchema } from 'typeorm'
import type { ItemKind } from '@shared/workspace'

/**
 * Índice de la bóveda: una fila por carpeta o archivo. El disco manda; esto se reconstruye con `sync()`.
 * `inode` permite reconocer un renombre hecho en Finder (mismo inode, otra ruta) y conservar el id.
 */
export interface WorkspaceRow {
  id: string
  kind: ItemKind
  path: string
  name: string
  parentId: string | null
  inode: string
  size: number
  mtimeMs: number
  /** Texto de las notas (para buscar y servir sin leer el disco). Null en lo demás. */
  text: string | null
  createdAt: string
  updatedAt: string
}

export const WorkspaceItemModel = new EntitySchema<WorkspaceRow>({
  name: 'WorkspaceItem',
  tableName: 'workspace_items',
  columns: {
    id: { type: 'text', primary: true },
    kind: { type: 'text' },
    path: { type: 'text', unique: true },
    name: { type: 'text' },
    parentId: { name: 'parent_id', type: 'text', nullable: true },
    inode: { type: 'text' },
    size: { type: 'integer' },
    mtimeMs: { name: 'mtime_ms', type: 'real' },
    text: { type: 'text', nullable: true },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' }
  },
  indices: [
    { name: 'idx_workspace_parent', columns: ['parentId'] },
    { name: 'idx_workspace_inode', columns: ['inode'] }
  ]
})

/** Una nota o un board que enlaza a otro elemento (imagen, nota incrustada). */
export interface WorkspaceRef {
  fromId: string
  toId: string
}

export const WorkspaceRefModel = new EntitySchema<WorkspaceRef>({
  name: 'WorkspaceRef',
  tableName: 'workspace_refs',
  columns: {
    fromId: { name: 'from_id', type: 'text', primary: true },
    toId: { name: 'to_id', type: 'text', primary: true }
  },
  indices: [{ name: 'idx_workspace_refs_to', columns: ['toId'] }]
})
