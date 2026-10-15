# Tareas · Notas relacionadas

- [x] 1. Migración `AddNoteRelations` + `NoteRelationModel`
- [x] 2. `NoteService.view`, `search`, `link`, `unlink`, `create` con links; borrar relaciones al borrar
      nota; ayudantes `notesOfClient` y `removeRelationsOf`
- [x] 3. `ClientDetail.notes` en `ClientService.get`
- [x] 4. Rutas, controlador, IPC (`notes:view|search|link|unlink`), preload
- [x] 5. Tests puros: canónico A–B = B–A; no auto-relación; duplicado ignorado
- [x] 6. UI: `RelatedChips`, `RelatedNotesSection`, `NotePicker`; `NoteEditor` con índice arriba y abajo
- [x] 7. Navegación con `trail` en el menubar; pantalla `note` en Consultora
- [x] 8. Ficha de cliente: sección Notas (nueva, relacionar, abrir)
- [x] 9. MCP: `get_note` con relaciones, `search_notes`, `link_notes`, `unlink_notes`,
      `link_note_client`, `unlink_note_client`, `create_note` con links; `get_client` con notas
- [x] 10. DESIGN.md: índice de relacionadas

## Checklist

- [ ] Relaciono A con B desde A: B muestra A arriba y abajo
- [ ] Desde un cliente, «Nueva nota» crea una nota que ya muestra el chip del cliente
- [ ] Borrar B: A ya no la muestra
