# Diseño · Notas relacionadas

## Modelo

Migración `AddNoteRelations1728400000000`:

```sql
CREATE TABLE note_relations (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  target_type TEXT NOT NULL,          -- 'note' | 'client'  (abierto a 'project' | 'prospect' después)
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX uq_note_relations ON note_relations (note_id, target_type, target_id);
CREATE INDEX idx_note_relations_target ON note_relations (target_type, target_id);
```

Nota ↔ nota se guarda **una vez** en forma canónica: `note_id` = el id menor, `target_id` = el mayor.
Leer las relacionadas de X = filas `note` donde `note_id = X` o `target_id = X`.

`src/shared/notes.ts`:

```ts
export type NoteBrief = Pick<Note, 'id' | 'date' | 'updatedAt'> & { title: string; excerpt: string }
export interface NoteView { note: Note; related: NoteBrief[]; clients: { id: string; name: string }[] }
export interface NotesApi {
  // existentes…
  view(id: string): Promise<NoteView>
  search(query: string, limit?: number): Promise<NoteBrief[]>
  link(id: string, target: { type: 'note' | 'client'; id: string }): Promise<NoteView>
  unlink(id: string, target: { type: 'note' | 'client'; id: string }): Promise<NoteView>
  create(body: string, links?: { notes?: string[]; clients?: string[] }): Promise<Note>
}
```

## Servicio (`NoteService`)

- `view(id)`: nota + relacionadas (2 consultas) + clientes (join con `clients`).
- `search(query, limit = 20)`: `body LIKE %q%` (sin acentos vía `normalizeName` en memoria si hace
  falta), ordena por `updatedAt`; devuelve `NoteBrief` con `noteTitle`/`noteExcerpt`.
- `link`: valida que existan, no consigo misma, canónico para notas, `INSERT OR IGNORE` por el índice
  único.
- `remove(id)`: borra relaciones donde aparece (como `note_id` o `target_id` de tipo nota).
- Ayudante exportado `notesOfClient(manager, clientId): NoteBrief[]` y
  `removeRelationsOf(manager, type, id)` (lo usa el borrado de clientes).
- `ClientDetail` gana `notes: NoteBrief[]`.

HTTP: `GET /notes/:id/view`, `GET /notes/search?q=`, `POST /notes/:id/links`,
`DELETE /notes/:id/links/:type/:targetId`, `POST /notes` con `links`.

## UI

Componentes nuevos en `src/renderer/src/components/` (compartidos por ambas ventanas):

- `molecules/RelatedChips` · fila «Relacionadas:» con chips (nota = surface-raised, cliente = surface-
  raised con icono maletín). Envuelve en varias líneas; nunca scroll horizontal.
- `organisms/RelatedNotesSection` · cabecera de sección + lista estilo Notes List (título bold, fecha
  micro, extracto caption) + quitar (icono X, rose al hover) + botón quiet «Relacionar».
- `organisms/NotePicker` · `Modal` con `SearchField` y resultados; Enter elige; excluye la propia
  nota y las ya relacionadas. Pestaña «Clientes» para elegir cliente.
- `NoteEditor` recibe `view: NoteView` y callbacks `onOpenNote`, `onOpenClient?`. Coloca
  `RelatedChips` bajo la cabecera y `RelatedNotesSection` al final del contenido (en modo Ver tras el
  markdown; en modo Escribir bajo el textarea).

Navegación:

- Menubar (`App.tsx`): `Screen` nota pasa a `{ name: 'note'; note: Note; trail: string[] }`; abrir una
  relacionada empuja el id actual; «Atrás» saca de `trail` o vuelve a Notas. El chip de cliente abre
  la ventana Consultora en ese cliente (`openConsultora` gana un destino opcional
  `{ client: id }`; main lo reenvía a la ventana con `consultora:navigate`).
- Consultora: `Screen` nuevo `{ name: 'note'; id: string }` que renderiza `NoteEditor`; la ficha del
  cliente lista sus notas con `go({ name: 'note', id })`.

Brief impeccable (Read/Operate): el índice superior es una línea discreta (caption milk-soft) para no
competir con el título; el inferior es el «ver también» completo. Mismo look en las dos ventanas.

## MCP

`get_note` (devuelve `NoteView`) · `search_notes { query }` · `link_notes { id, other }` ·
`unlink_notes` · `link_note_client { id, client }` · `unlink_note_client` · `create_note { body,
related_notes?, clients? }`.
