# Tareas

## Fase 0 · Confirmar decisiones (dueño)

- [x] 0.1 Quitar edición en línea de la fila (editar solo en detalle)
- [x] 0.2 Herramientas MCP de notas
- [x] 0.3 Lista de notas sin chips de periodo en v1
- [x] 0.4 Borrar nota con botón de dos pasos

## Fase 1 · Datos y backend

- [x] 1. `shared/tasks.ts`: `description` en `Task` y `TaskPatch` (R1.4)
- [x] 2. `shared/notes.ts`: tipos, `NotesApi`, `noteTitle()`, `noteExcerpt()` (R2.3)
- [x] 3. Migraciones `AddTaskDescription` y `CreateNotes`; registrar en `data-source.ts` (R5.4)
- [x] 4. `task.model` / `task.service` / `task.view` / `task.controller`: descripción (R1.4, R4.2)
- [x] 5. `note.model`, `note.service`, `note.view`, `note.controller`, `note.routes`; montar en `server.ts` (R2, R5.1)
- [x] 6. `ipc.ts` + `preload` (+ `index.d.ts`): `window.api.notes` (R2)

## Fase 2 · Markdown

- [x] 7. Añadir `react-markdown` y `remark-gfm` (R3.1)
- [x] 8. `Markdown.tsx` (bloque + inline) y estilos `.md` en `main.css` vía impeccable (R3.3, R3.4)
- [x] 9. `MarkdownEditor.tsx` (Escribir/Ver, `⌘E`, `Tab`) + `useAutosave.ts` (R2.6, R1.6)

## Fase 3 · Pantallas

- [x] 10. `App.tsx`: tipo `Screen`, pestaña Notas, `Esc`/Atrás, atajos (R1.2, R2.1)
- [x] 11. Extraer `DayHeading`, `Pager`, `BackButton` de `HistoryView` (sin cambiar su aspecto)
- [x] 12. `TaskDetail.tsx`; `TaskRow` abre detalle + icono de descripción; Historial abre detalle (R1)
- [x] 13. `NotesView.tsx` (lista por días) y `NoteEditor.tsx` (R2.2–R2.7)
- [x] 14. Diseño según impeccable craft-floor (sin pasada visual: la app no corre aquí)

## Fase 4 · MCP y docs

- [x] 15. `mcp/index.ts`: `description` en tareas + herramientas de notas (R4)
- [x] 16. README (herramientas, atajos) y PRODUCT.md (Notas entra en alcance)

## Fase 5 · Verificación (dueño)

- [ ] 17. `npm install`, `typecheck`, `lint`
- [ ] 18. `npm run service:install` y probar: detalle, descripción, notas, markdown, MCP
