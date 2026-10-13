# Diseño · Administración de tags

## Modelo

Migración `AddTagAudience1728300000000`:

```sql
ALTER TABLE tags ADD COLUMN audience BOOLEAN NOT NULL DEFAULT 0;
UPDATE tags SET audience = 1 WHERE segment_id IS NOT NULL;
```

`Tag` gana `audience: boolean`. `TaskTagSummary { tag: string; tasks: number }`.

## Servicios

`TagService` (contactos):

- `list()` igual + `audience`.
- `remove(slug)` en una transacción:
  1. `usage(manager, slug)` → `{ automations: {id,name,active}[]; sources: string[] }` (módulo 7;
     hasta entonces lee `RuleModel`). Si hay automatizaciones activas,
     `AppError('invalid', 'Lo usan las automatizaciones: A, B. Cámbialas o páusalas.')`.
  2. Borrar `contact_tags` del tag, quitar el slug de `lead_sources.default_tags`.
  3. Si `segmentId`: encolar job de outbox `segment_delete` `{ segmentId }`.
  4. Borrar el tag; `configChanged()` (el Worker deja de usar el segment).
- `setAudience(slug, on)`: on → encolar sync de todos sus contactos suscritos (crea el Segment en el
  primer job); off → job `segment_delete` y `segmentId = null`.

Outbox: `OutboxJob.kind` añade `'segment_delete'`. `MarketingSync` lo procesa con
`gateway.deleteSegment(id)` (nuevo en `ResendGateway`; 404 = hecho).

Segments solo para audiencias:

- `marketing-sync` (sincronizar contacto): `desired` = segments de tags del contacto **con
  `audience`**; quita al contacto de segments de tags que ya no son audiencia.
- `newsletter.service`: rechaza `tag` sin `audience` («Marca el tag como audiencia en Tags»).
- `HubConfig` gana `audience: string[]`; el Worker solo llama a `ensureSegment`/`addToSegment` para
  esos slugs. (Se despliega junto al módulo 7.)

`TaskService` (tareas):

- `tagSummaries(): TaskTagSummary[]` (cuenta en memoria; uso personal).
- `renameTag(from, to)`: recorre tareas con el tag (`tags LIKE '%"from"%'` y filtro exacto), reemplaza
  y deduplica.
- `removeTag(tag)`: igual, quitándolo.

API HTTP: `GET /marketing/tags` (+audience), `GET /marketing/tags/:slug/usage`, `PATCH /marketing/tags/:slug` (`name`, `audience`),
`DELETE /marketing/tags/:slug`, `GET /task-tags`, `PATCH /task-tags/:tag`, `DELETE /task-tags/:tag`.

## UI

`screens/Tags.tsx` (organism `TagTable` reutilizado por las dos secciones):

- Cabecera: título «Tags», `SearchField`.
- Sección Contactos: filas `Row` con `TagPill`, `n contactos · n suscritos`, toggle «Audiencia»
  (pill quiet; activo = surface-raised + milk + icono `Radio` apricot), `EditableText` para el
  nombre, `ConfirmButton` rose.
- Sección Tareas: `#tag`, `n tareas`, renombrar, borrar.
- Antes del segundo clic de borrar se pide `usage`: si lo usan automatizaciones activas, el botón
  no borra y aparece un `ErrorNote` con enlace a cada una; si solo lo usan fuentes, se avisa en el texto.
- Al terminar una acción: recargar la lista y emitir `tags:changed` (evento de ventana) para que los
  filtros abiertos se refresquen.

Brief impeccable (Operate): una tabla de mantenimiento, no un tablero. Los tags no llevan color (son
etiquetas, no estados, DESIGN.md). Audiencia es lo único con estado visible. Lo destructivo siempre
en dos pasos y con su consecuencia escrita («Se quita de 34 contactos»).

## MCP

`list_tags { kind?: 'contact' | 'task' }` · `rename_tag { slug, name }` · `set_tag_audience { slug,
audience }` · `delete_tag { slug, confirm: true }` · `rename_task_tag { from, to }` ·
`delete_task_tag { tag, confirm: true }`.
