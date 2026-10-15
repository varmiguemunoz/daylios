# Diseño · W2 Notas en la bóveda

## Storage de notas

`NoteService` conserva su interfaz pública: `list`, `get`, `view`, `search`, `create`, `update`,
`remove`, `link`, `unlink`. Por dentro deja la tabla `notes` y usa `WorkspaceService`:

- `create(body)`: escribe `Notas rápidas/<fecha> <título>.md` y devuelve la fila del índice como
  `Note`. `date` sale de `created_at`.
- `update(id, body, expectedMtime?)`: escribe el archivo. Si el mtime no coincide, `AppError`
  con código `conflict`.
- `list(page)`: notas de `Notas rápidas/` por `updated_at`.
- `search(query)`: sobre `workspace_items.text` en toda la bóveda, sin acentos.
- `remove(id)`: a la Papelera y borra sus relaciones con `removeRelationsOf`.
- `rename(id)`: tras guardar, si la primera línea cambió, renombra el archivo y reescribe
  referencias. Lo llama el editor al salir, no en cada tecla.

`note_relations` no cambia: sus ids ahora son ids del índice.

## Migración al arranque

`main/services/notes-to-vault.ts`, se llama tras `sync()` del workspace:

1. Si existe la tabla `notes` con filas: por cada nota sin fila en el índice, escribe el archivo y
   crea la fila con el mismo id.
2. Cuando todas están, renombra `notes` a `notes_legacy` en una transacción.
3. Idempotente: empareja por id, nunca por título.

## Imágenes en notas

- `Markdown.tsx` resuelve `src` relativos contra la ruta de la nota y los convierte a
  `vault://path/<ruta>`. El protocolo de W1 acepta también `path/`, siempre validado.
- `MarkdownEditor` gana `onPasteFiles(files)`: la pantalla los sube con `workspace.attach(noteId,
file)` y recibe la ruta relativa para insertar.

## UI

- `consultora/workspace/screens/NoteScreen.tsx`: reutiliza `NoteEditor` en modo ventana, como ya
  hace `consultora/screens/Note.tsx`, con ruta de navegación arriba.
- `NoteEditor` gana el aviso de conflicto con dos botones.
- Menubar: `NotesView` sin cambios visibles, lee de la nueva fuente.

## Pruebas

`notes-to-vault.test.ts`: migra, conserva ids, reintento sin duplicar. `note.service.test.ts`
adaptado a disco temporal: conflicto por mtime, renombre por título, búsqueda en toda la bóveda.
