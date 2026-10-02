# Diseño · Detalle de tarea + Notas

## 1. Navegación (sin router)

`App.tsx` guarda una sola variable de pantalla:

```ts
type Screen =
  | { name: 'today' }
  | { name: 'history' }
  | { name: 'notes' } // con barra de pestañas
  | { name: 'task'; task: Task; from: 'today' | 'history' } // detalle, sin pestañas
  | { name: 'note'; note: Note } // editor («Nueva» crea la nota vacía antes)
```

- «Atrás» y `Esc` vuelven a `from` (tarea) o a `notes` (nota). Fuera del detalle, `Esc` sigue cerrando la ventana.
- Al volver de una tarea, `useDay` recarga (ya escucha cambios) para reflejar título/estado.
- Atajos: `⌘1` Hoy, `⌘2` Historial, `⌘3` Notas, `⌘N` nueva tarea (Hoy) o nueva nota (Notas), `⌘E` Escribir/Ver.

## 2. Datos

### Tarea: columna nueva

`tasks.description TEXT NULL`. Migración `AddTaskDescription` con `queryRunner.addColumn` (TypeORM, sin SQL).
`Task.description: string | null` en `src/shared/tasks.ts`; `TaskPatch.description?: string`.

### Nota: tabla nueva

```
notes
  id          TEXT PK (uuid)
  body        TEXT      markdown completo
  date        TEXT      YYYY-MM-DD local, día de creación (agrupa la lista)
  created_at  TEXT      ISO
  updated_at  TEXT      ISO
  índice (date, updated_at)
```

El título **no se guarda**: es la primera línea no vacía del cuerpo sin `#`, `*`, etc.
Una sola fuente de verdad, nada que sincronizar. Lo calcula `noteTitle()` en `src/shared/notes.ts` (lo usan UI, vista HTTP y MCP).

## 3. Backend (mismo patrón MVC)

```
src/shared/notes.ts                 Note, NotesPage, NotesApi, noteTitle(), noteExcerpt()
src/main/models/note.model.ts       EntitySchema<Note>
src/main/db/migrations/AddTaskDescription.ts
src/main/db/migrations/CreateNotes.ts
src/main/services/note.service.ts   list (paginado por día), get, create, update, remove — escrituras vía transactionGuard
src/main/views/note.view.ts         noteView (añade title y excerpt para Claude)
src/main/controllers/note.controller.ts
src/main/routes/note.routes.ts
```

Cambios en archivos existentes: `task.model` (+description), `task.service` (validar descripción ≤ 20 000), `task.view` (+description), `task.controller` (leer `description`), `data-source` (+modelo, +2 migraciones), `server.ts` (+rutas de notas), `ipc.ts` (+canales `notes:*`), `preload` (+`window.api.notes`).

### API local nueva

| Método | Ruta                     | Cuerpo / query               |
| ------ | ------------------------ | ---------------------------- |
| GET    | `/notes?page=&pageSize=` | → NotesPage (días con notas) |
| GET    | `/notes/:id`             | → nota                       |
| POST   | `/notes`                 | `{ body }`                   |
| PATCH  | `/notes/:id`             | `{ body }`                   |
| DELETE | `/notes/:id`             |                              |

`PATCH /tasks/:id` y `POST /tasks` aceptan `description`.

## 4. Markdown

Librerías (renderer, `devDependencies` como el resto de la UI):

- `react-markdown` — markdown a React, sin `dangerouslySetInnerHTML`, ignora HTML crudo.
- `remark-gfm` — tablas, listas de tareas, tachado, autoenlaces.

Un componente, dos modos (`src/renderer/src/components/Markdown.tsx`):

```tsx
<Markdown text={body} />          // bloque completo: notas y descripción
<Markdown text={title} inline />  // solo strong/em/del/code/a; para títulos de tarea
```

- `inline` usa `allowedElements` + `unwrapDisallowed`: un `# hola` en un título se ve como texto, no como encabezado.
- Enlaces con `target="_blank"`: `window.ts` ya los manda al navegador del sistema.
- Estilos en `main.css` bajo una sola clase `.md` (h1–h3, p, ul/ol, task list, blockquote, code, pre, table, hr, a).

Editor (`src/renderer/src/components/MarkdownEditor.tsx`): `textarea` + interruptor Escribir / Ver.

- Escribir: `textarea` a toda la altura, Nunito, `spellcheck`, `Tab` inserta dos espacios.
- Ver: `<Markdown>`. Nota/descripción vacía en Ver muestra un texto guía.
- Nota nueva y descripción vacía abren en Escribir; con contenido abren en Ver.

Guardado automático (`src/renderer/src/lib/useAutosave.ts`, ~20 líneas):
espera 500 ms sin teclear y guarda; al salir de la pantalla guarda lo pendiente. Estado visible: «Guardando…» / «Guardado».

## 5. Pantallas (DESIGN.md manda; sin colores nuevos)

### Detalle de tarea

```
[‹ Atrás]                     Hoy · 1 oct
( ) Título editable (markdown en línea)      ← clic en el título = editar; fuera = vista
    «de ayer» si aplica
──────────────
[ Escribir | Ver ]                 Guardado
descripción markdown (scroll)
──────────────
[Borrar]                   (rose al hover)
```

- Círculo de completar igual que en la fila (26px, mint al hacer). Atrás: icon-button pill 36px.
- Interruptor Escribir/Ver = estilo tab-switcher pequeño.
- Borrar: borra, vuelve atrás y muestra el toast «Tarea eliminada · Deshacer» que ya existe.

### Fila de tarea (cambio)

- Clic en el texto (o `Enter`) abre el detalle. El círculo sigue completando, `Espacio` también.
- Se quita la edición en línea (doble clic + lápiz): editar pasa al detalle.
- Si tiene descripción: icono pequeño `AlignLeft` en milk-soft junto al título.

### Lista de notas (copia de Historial)

```
Notas                          [+ Nueva]
Hoy
┌──────────────────────────────────────┐
│ Título de la nota            14:32   │
│ extracto en una línea…               │
├──────────────────────────────────────┤
│ …                                    │
└──────────────────────────────────────┘
Ayer
…
‹  Página 1 de 3  ›
```

- Mismas tarjetas `surface` redondeadas, separadores hairline, títulos de día `relativeDay`, paginación y fade inferior de Historial.
- «Nueva»: pill apricot (acción = apricot). Vacío: «Aún no hay notas.» + botón.
- Sin chips de periodo en v1.

### Editor de nota

```
[‹ Notas]          [ Escribir | Ver ]   [🗑]
textarea / vista a toda la altura
Guardado · 1 oct 14:32
```

- Borrar: botón de dos pasos (primer clic cambia a «¿Borrar?» en rose; al salir del botón vuelve a su estado).

## 6. Reutilización para no duplicar

- `DayHeading` (título de día + slot derecho) y estilos de tarjeta se sacan de `HistoryView` a un componente que usan Historial y Notas.
- `Pager` (paginación ‹ Página n de m ›) igual.
- `BackButton` compartido por los dos detalles.

## 7. MCP

- Tareas: `description` en `create_task` / `update_task`; ya sale en `get_day`.
- Notas: `list_notes(page?)`, `get_note(id)`, `create_note(body)`, `update_note(id, body)`, `delete_note(id)`.

## 8. Riesgos

- Ventana de 400px: el editor es estrecho. Se acepta (uso en ráfagas). Ancho fijo no cambia.
- `react-markdown` añade ~40 KB gz al renderer. Aceptable en local.
