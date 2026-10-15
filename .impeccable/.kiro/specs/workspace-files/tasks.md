# Tareas · W1 Bóveda, carpetas y archivos

- [x] 1. Tipos en `shared/workspace.ts`; ajuste `workspacePath` en `config.ts` y en Ajustes
- [x] 2. Migración `CreateWorkspace`; modelos `WorkspaceItemModel` y `WorkspaceRefModel`
- [x] 3. `vault.ts` con confinamiento de rutas y sus pruebas
- [x] 4. `WorkspaceService`: sync por inode, list, tree, CRUD, mover, impacto, papelera, subir,
      reescritura de referencias; pruebas con carpeta temporal
- [x] 5. `workspace-watcher.ts` y arranque en `main/index.ts`
- [x] 6. Protocolo `vault://`
- [x] 7. Controlador, rutas, IPC, preload e `index.d.ts`
- [x] 8. Primitivos `ContextMenu`, `Breadcrumbs`, `FolderPicker`
- [x] 9. `WorkspaceApp`, `FolderTree`, `FolderView`, `DeleteItemModal`, `ImageView`; sección en
      la barra lateral
- [x] 10. Estados vacío, carga y error; árbol plegable en ventana estrecha
- [x] 11. impeccable: `critique` del workspace y corregir en un lote
- [x] 12. DESIGN.md: árbol, vista de carpeta, menú contextual

## Checklist

- [ ] Creo una carpeta con dos subcarpetas, la renombro y la muevo: todo se ve igual en Finder
- [ ] Renombro un archivo en Finder: la app lo muestra con el nuevo nombre en menos de 2 s
- [ ] Arrastro tres imágenes desde Finder: quedan en la carpeta actual y se ven en la app
- [ ] Borro una carpeta con contenido: veo el impacto y todo acaba en la Papelera
- [ ] Lista y cuadrícula se recuerdan por carpeta
