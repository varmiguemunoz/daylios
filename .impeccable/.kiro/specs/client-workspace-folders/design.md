# Diseño · Carpetas de cliente en el Workspace

## Estado actual

| pieza | hoy |
|---|---|
| ruta por defecto | `insertClient`: `join(config.docsPath(), safeFolderName(name))` |
| subcarpetas | `documents.ts`, `ensureClientFolder`, `CLIENT_SUBFOLDERS` |
| lista de la ficha | `listDocuments(folderPath)`, plana, profundidad 3 |
| nube | `sync.ts`: `relocateClientFolders` y `fill` usan `docsPath()` |
| columna | `clients.folder_path` absoluta y local, `LOCAL_ONLY.columns` en `shared/edition.ts` |
| grabaciones | `meeting.service.ts` mueve a `<folderPath>/Reuniones` con `moveInto` |
| Workspace | `WorkspaceService` indexa `config.workspacePath()` y vigila cambios |

## Cambios

### Una sola fuente para la ruta

```ts
// main/services/documents.ts
export const CLIENTS_FOLDER = 'Clientes'
export function clientFolderFor(workspaceRoot: string, name: string): string
```

La usan `insertClient`, `update` al renombrar, `sync.ts` en `relocateClientFolders` y `fill`, y la
migración. `safeFolderName` se endurece para Windows: quita punto y espacio finales y añade `_` a
los nombres reservados.

### Renombrar

`ClientService.update` con nombre nuevo: si la carpeta está en `Workspace/Clientes`, la renombra
con el `WorkspaceService` para conservar ids, enlaces y referencias de boards. Luego actualiza
`folder_path` y los `recording_path` que empiecen por la ruta vieja, en la misma transacción.

### Migración

`main/services/client-folders.migration.ts`, pura salvo el sistema de archivos inyectado:

1. Lista clientes con `folder_path` fuera de `Workspace/Clientes`.
2. Copia cada carpeta a `docsPath/_respaldo/<fecha>/`.
3. Mueve con `rename`; si falla por estar en otro disco, copia y borra.
4. Fusiona sin pisar si el destino existe.
5. Actualiza `folder_path` y `recording_path` sin registrar cambios para la nube, con
   `withoutChangeLog`, porque las dos columnas son locales.
6. Marca hecha en `settings.json` con la versión de la migración.

Corre al arrancar, después de abrir la base de datos y antes del primer `WorkspaceService.sync`.

### Ficha del cliente

- Nuevo endpoint `clients.files(ref)` que devuelve el árbol de la carpeta usando el índice del
  Workspace: `WorkspaceService.list(folderId)` recursivo, con kind, id, ruta, tamaño y fecha.
- Las acciones de crear, subir, renombrar y borrar reutilizan el API del Workspace con el `folderId`
  de la carpeta del cliente.
- Organismo `ClientFiles` con átomos ya existentes del explorador del Workspace. Sustituye la
  sección Documentos de `screens/Client.tsx`.
- La ficha escucha el aviso de cambios del Workspace y vuelve a pedir `files`.

### Notas por carpeta

Sin tabla nueva: `ClientService.detail` une las relaciones manuales con las notas cuyo `path` está
bajo la carpeta del cliente. Cada nota lleva `origin: 'manual' | 'folder'`. Al estar calculado, no
hay nada que sincronizar ni que limpiar al mover una nota.

### Windows

Las rutas relativas que se guardan o se envían al renderer usan `/`. `listDocuments` hoy devuelve
`relative()` con `\` en Windows; se normaliza.

## Pruebas

| tipo | qué |
|---|---|
| unidad | `clientFolderFor`, `safeFolderName` con nombres de Windows |
| unidad | migración: mueve, respalda, fusiona, actualiza rutas, se puede repetir |
| integración | crear, renombrar y borrar cliente con `tempWorkspace`; notas por carpeta en `detail` |
| integración | `sync.ts` crea la carpeta en `Workspace/Clientes` para un cliente recibido |

## Riesgos

| riesgo | mitigación |
|---|---|
| perder archivos al mover | copia de seguridad antes y fusión sin pisar |
| grabaciones con ruta vieja | se actualizan en la misma pasada |
| boards que referencian archivos movidos | el movimiento entra al Workspace como carpeta nueva; las rutas antiguas no estaban en el Workspace, así que no hay referencias que romper |
| carpeta abierta en otra app en Windows | el `rename` falla; se reintenta en el siguiente arranque y se avisa |
