# Diseño · W1 Bóveda, carpetas y archivos

## Datos

`src/shared/workspace.ts`

```ts
type ItemKind = 'folder' | 'note' | 'board' | 'image' | 'file'

interface WorkspaceItem {
  id: string
  kind: ItemKind
  /** Relativa a la bóveda, con `/`. La raíz es ''. */
  path: string
  name: string // sin extensión para note y board
  parentId: string | null
  size: number
  createdAt: string
  updatedAt: string
}

interface FolderListing {
  folder: WorkspaceItem | null // null = raíz
  crumbs: { id: string | null; name: string }[]
  items: WorkspaceItem[]
}

interface DeleteImpact {
  notes: number
  boards: number
  files: number
  folders: number
  referencedBy: number
}
```

Tabla `workspace_items`: `id, kind, path unique, name, parent_id, inode, size, text, created_at,
updated_at`. `text` guarda hasta 200 KB del contenido de las notas para buscar.

Tabla `workspace_refs`: `from_id, to_id, kind` con kind `image` o `embed`. Se recalcula al guardar
una nota o un board.

## Puerto de disco

`main/services/vault.ts`, funciones puras sobre una raíz:

- `resolveInVault(root, rel)`: normaliza, rechaza `..`, rutas absolutas y symlinks que salen,
  con `realpath`. Reutiliza `safeFolderName` de `documents.ts`.
- `scan(root)`: recorre la bóveda y devuelve `{ path, kind, inode, size, mtime }`.
- `mkdir`, `readText`, `writeText(expectedMtime)`, `move`, `copyIn(src)`, `trash` con el
  `moveToTrash` existente.

## Servicio

`main/services/workspace.service.ts`

- `sync()`: compara el disco con el índice. Empareja por inode primero y por ruta después, así un
  renombre hecho en Finder conserva el id. Inserta, actualiza y borra filas. Emite `data:changed`.
- `list(folderId)`, `tree()`, `get(id)`, `search(query)`.
- `createFolder(parentId, name)`, `rename(id, name)`, `move(id, targetFolderId)`,
  `impact(id)`, `remove(id)`, `upload(folderId, filePaths)`.
- `rewriteRefs(fromPath, toPath)`: tras mover o renombrar, reescribe enlaces `![](…)` en notas y
  rutas `file` en boards que apuntaban al elemento.

`main/services/workspace-watcher.ts`: `fs.watch(root, { recursive: true })`, con espera de 300 ms
y luego `sync()`. Mientras la app escribe, ignora sus propios eventos con una marca de tiempo.

## Protocolo

`main/index.ts` registra `vault://` como esquema privilegiado. `vault://item/<id>` resuelve el id
en el índice y sirve el archivo con `net.fetch` sobre su ruta validada.

## API

Rutas `/workspace/*` en Express, IPC `workspace:*` y `window.api.workspace` en el preload, con los
métodos del servicio. Subir usa `dialog.showOpenDialog` desde main y, al arrastrar desde Finder,
`webUtils.getPathForFile` en el preload.

## UI

Primitivos nuevos en `src/renderer/src/ui`:

- `molecules/ContextMenu`: posicionado en el cursor o bajo un botón, flechas y Enter, Esc cierra.
  Usa la pila de `overlay.ts`.
- `molecules/Breadcrumbs`.
- `organisms/FolderPicker`: modal con buscador de carpetas, para «Mover a…».

Pantallas en `consultora/workspace/`:

- `WorkspaceApp.tsx`: árbol a la izquierda y contenido a la derecha. Rutas internas `folder`,
  `note`, `board`, `image`.
- `organisms/FolderTree.tsx`: plegable, destino de arrastre, foco con flechas.
- `organisms/FolderView.tsx`: lista o cuadrícula con `SegmentedToggle`, menú contextual, destino de
  archivos desde Finder.
- `organisms/DeleteItemModal.tsx`: impacto y confirmación.
- `screens/ImageView.tsx`: imagen ajustada, zoom con la rueda.

## Pruebas

`vault.test.ts`: rutas que escapan, nombres inválidos. `workspace.service.test.ts` con carpeta
temporal: CRUD, mover dentro de sí misma rechazado, renombre externo conserva id, referencias
reescritas al mover.
