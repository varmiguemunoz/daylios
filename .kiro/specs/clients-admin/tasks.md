# Tareas · Administración de clientes

- [x] 1. Puerto `Trash` (`shell.trashItem`) inyectado en servicios
- [x] 2. `ProjectService.remove`; `ClientService.impact` y `remove`
- [x] 3. `documents.ts`: `safePath`, `renameDocument`, `trashDocument`, `writeDocument`
- [x] 4. Rutas, controladores, IPC y preload
- [x] 5. Tests puros: `safePath` rechaza `../`; renombrar no pisa; escribir rechaza binarios
- [x] 6. UI: `DeleteClientModal`, borrar proyecto (fila y ficha), acciones de documento, pantalla
      `document`
- [x] 7. MCP: `get_client_impact`, `delete_client`, `delete_project`, `rename_document`,
      `delete_document`, `write_document`

## Checklist

- [ ] Borrar un cliente con 2 proyectos y 3 reuniones: las reuniones siguen en Reuniones sin cliente;
      la carpeta sigue en el Escritorio
- [ ] Con la casilla marcada, la carpeta aparece en la Papelera
- [ ] Renombrar `propuesta.md` a `propuesta-v2.md` y editarlo dentro de la app
