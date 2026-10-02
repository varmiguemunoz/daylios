# Diseño

## Datos (migración `AddTagsEffortContacts`, TypeORM, sin SQL)
```
tasks       + tags (simple-json string[], default '[]')  + effort (text null: alto|medio|bajo)
prospects   + position (integer, default 0)              orden dentro de su etapa
meetings    + language (text null: es|en)                 idioma hablado para Whisper
contacts    id, name, role?, email?, phone?, linkedin?, notes_md, client_id?, prospect_id?, created_at, updated_at
```

## Tareas
- `src/shared/tasks.ts`: `Effort`, `parseCapture(text) → { title, tags, effort }`, `cleanTag()`.
- `TaskService.add(date, title, description?, extra?)`: `extra = { tags, effort }`; `update` acepta `tags` y `effort`.
- `TaskService.reorder(date, ids)`: posiciones 0..n en una transacción (ids que no son del día → error).
- `TaskService.tags()`: tags usados (para sugerencias), por frecuencia.
- `useDay.add()` usa `parseCapture`; `useDay.reorder()` optimista.

## Arrastrar (HTML5 nativo, sin librería)
`src/renderer/src/lib/useReorder.ts` (~40 líneas): guarda el id arrastrado y el índice de destino;
la lista pinta una línea apricot en ese índice. `onDrop` → `onMove(id, index)`.
Lo usan Hoy (filas) y el Pipeline (tarjetas por columna). Al soltar fuera, no pasa nada.

## Pipeline
`ProspectService.move(ref, stage, index?)`: cambia etapa (como antes) y reordena la etapa destino poniendo
el prospecto en `index`. `pipeline()` ordena por `position`. El selector de etapa del detalle sigue.

## Contactos (MVC igual que el resto)
`models/contact.model.ts`, `services/contact.service.ts` (list con filtro cliente/prospecto/búsqueda, get, create,
update, remove), `controllers/contact.controller.ts`, rutas `/consultora/contacts…`, IPC `consultora:*Contact*`.
Pantallas: `Contacts.tsx` (lista + búsqueda + nuevo), `Contact.tsx` (detalle). Sección reutilizable `ContactsSection`
en cliente y prospecto. Ganar prospecto: `UPDATE contacts SET client_id` vía repositorio en la misma transacción.

## Subir grabaciones
```
Reuniones ─ «Subir grabación» / soltar archivo ─► ImportSheet (título, participantes, asociación, idioma)
         ─► recording.import(path, info) ─► copia a _reuniones/ (o carpeta del cliente) ─► reunión (transcribing)
         ─► mismo pipeline: ffmpeg (audio 16 kHz, trozos 10 min) ─► Whisper { language } ─► resumen
```
- Archivo soltado: `webUtils.getPathForFile(file)` en preload.
- Duración: `ffmpeg -i` imprime `Duration: hh:mm:ss`; se lee de ahí (sin ffprobe).
- Fecha: `birthtime` del archivo.
- `AiService.transcribe(files, hint, language?)` pasa `language` a Whisper.
- StopSheet (grabación en vivo) gana el mismo selector de idioma.

## UI (DESIGN.md)
- Chip de tag: pill 20 px, `surface-raised`, micro, milk-soft, `#tag`.
- Esfuerzo: 3 barras de 3×8/10/12 px; llenas en milk-soft, vacías hairline. En el detalle: tres pills (Bajo/Medio/Alto), activa = surface-raised + milk.
- Línea de destino al arrastrar: 2 px apricot (apricot = actuar).
- Fila arrastrándose: 40 % de opacidad.
