# Diseño · Administración de clientes

## Servicios

`ProjectService.remove(ref)` (transacción): `meetings.projectId = null`, `contacts.projectId = null`
(columna del módulo contacts-ux), borrar relaciones de notas `project` (si existieran), borrar.

`ClientService`:

```ts
interface ClientImpact { projects: number; meetings: number; contacts: number; prospects: number; notes: number; folderPath: string }
impact(ref): Promise<ClientImpact>
remove(ref, opts: { trashFolder: boolean }): Promise<void>
```

`remove` en una transacción: borrar proyectos del cliente → `meetings.clientId/projectId = null` →
`contacts.clientId/projectId = null` → `prospects.clientId = null` → `removeRelationsOf('client', id)`
→ borrar cliente. Tras confirmar (`afterCommit`), si `trashFolder`, `trash.move(folderPath)`.

Puerto `Trash` (`src/main/services/trash.ts`): `move(path): Promise<void>` implementado con
`shell.trashItem` en main; en tests, un fake. Así los servicios no importan Electron.

`documents.ts` (todas usan `safePath(folder, rel)`, extraído de `readDocument`):

- `renameDocument(folder, path, newName)`: solo nombre (sin `/`), mantiene subcarpeta, error si existe.
- `trashDocument(folder, path, trash)`.
- `writeDocument(folder, path, content, expectedModifiedAt?)`: solo `TEXT_EXTENSIONS`, máx 1 MB; si
  `expectedModifiedAt` no coincide → `AppError('invalid', 'Cambió fuera de la app. Recárgalo.')`.

HTTP: `GET /clients/:ref/impact`, `DELETE /clients/:ref?trashFolder=1`, `DELETE /projects/:ref`,
`PATCH /clients/:ref/documents` (`{ path, name }`), `DELETE /clients/:ref/documents?path=`,
`PUT /clients/:ref/documents` (`{ path, content, expectedModifiedAt }`).

## UI

- `Client.tsx`: cabecera con `IconButton` papelera → `DeleteClientModal` (organism): lista de impacto,
  casilla de carpeta, campo «Escribe el nombre para confirmar», botón rose habilitado solo si coincide.
- Filas de proyecto: acción `ConfirmButton` al hover/focus.
- Filas de documento: al hover/focus, `IconButton` Renombrar (convierte el nombre en input), Editar
  (solo texto) y `ConfirmButton` Borrar. Doble clic sigue abriendo con su app.
- Nueva pantalla `document` (`{ name: 'document'; client: string; path: string }`): cabecera con
  nombre y ruta relativa, `MarkdownEditor` (para `.txt` también; el modo Ver de un `.txt` muestra texto
  plano), `useAutosave` con `expectedModifiedAt`.
- `Project.tsx`: `ConfirmButton` en la cabecera.

Brief impeccable (Operate): borrar es raro y caro, así que se esconde hasta el hover/focus, pero su
consecuencia se escribe completa antes de confirmar. Nada de «¿Seguro?» genérico.

## MCP

`get_client_impact { client }` · `delete_client { client, confirm: true, trash_folder? }` ·
`delete_project { project, confirm: true }` · `rename_document { client, path, name }` ·
`delete_document { client, path, confirm: true }` · `write_document { client, path, content }`.
