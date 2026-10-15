# Tareas · Carpetas de cliente en el Workspace

S pequeña, M media, L grande. P0 imprescindible, P1 importante. Cada tarea termina con
`npm run check` sin errores.

## Fase A · Ruta única

- [x] A1 `CLIENTS_FOLDER`, `clientFolderFor` y `safeFolderName` válido en Windows, con pruebas. S · P0 ·
  R1.1, R1.2
- [x] A2 `insertClient` crea en `Workspace/Clientes`; reutiliza si existe. S · P0 · R1.1, R1.3 · tras A1
- [x] A3 `sync.ts` usa `clientFolderFor` en `relocateClientFolders` y `fill`. S · P0 · R4.1 a R4.3 ·
  tras A1
- [x] A4 Prueba de integración: crear cliente local y en organización. S · P0 · tras A2 y A3

## Fase B · Migración

- [x] B1 `client-folders.migration.ts` con respaldo, fusión y actualización de rutas. M · P0 · R2 ·
  tras A1
- [x] B2 Pruebas de la migración, incluida la repetición sin efecto. S · P0 · tras B1
- [x] B3 Llamada al arrancar y aviso en Ajustes si algo falló. S · P0 · R2.6 · tras B1

## Fase C · Renombrar y borrar

- [x] C1 Renombrar cliente renombra carpeta vía `WorkspaceService` y actualiza rutas. M · P0 · R1.4 ·
  tras A2
- [x] C2 Borrar con Papelera sin cambios; prueba con la nueva ruta. S · P1 · R1.5 · tras A2

## Fase D · Ficha del cliente

- [x] D1 Resuelto sin endpoint nuevo: `ClientFiles` usa el API del Workspace con `ClientDetail.folder`. Endpoint `clients.files` sobre el índice del Workspace, IPC y preload. M · P0 · R3.1 · tras A2
- [x] D2 Organismo `ClientFiles`: árbol, crear nota, board y carpeta, subir, renombrar, Papelera. M ·
  P0 · R3.1 a R3.4 · tras D1
- [x] D3 Refresco con el aviso del Workspace. S · P0 · R3.6 · tras D2
- [x] D4 Notas por carpeta en `ClientService.detail` con `origin`; marca en la sección Notas. S · P0 ·
  R3.5 · tras A2
- [x] D5 MCP: `get_client` con archivos y notas de carpeta. S · P1 · R5 · tras D1 y D4
- [x] D6 Rutas relativas con `/` en `listDocuments`. S · P0 · tras A1

## Fase E · Validación

- [x] E1 `npm test` en verde. S · P0
- [ ] E2 Checklist manual. S · P0

## Checklist

- [ ] Creo el cliente «Acme» y aparece `Workspace/Clientes/Acme` con sus cuatro subcarpetas
- [ ] Creo una nota en `Clientes/Acme` desde el Workspace y la veo en Archivos y en Notas de Acme
- [ ] Subo un PDF desde la ficha y lo veo en el Workspace
- [ ] Renombro Acme a «Acme SA»: la carpeta cambia y la nota sigue relacionada
- [ ] Al abrir la nueva versión, Dave Nelson y Juan Felipe están en `Workspace/Clientes` y hay copia en
  `.respaldo-clientes`
- [ ] La grabación de Dave Nelson sigue abriendo desde su reunión
- [ ] En una organización, la carpeta está en `Organizaciones/<Org>/Workspace/Clientes`
