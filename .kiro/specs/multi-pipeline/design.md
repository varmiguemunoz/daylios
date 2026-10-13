# Diseño · Pipelines

## Modelo

Migración `AddPipelines1728600000000`:

```sql
CREATE TABLE pipelines (id TEXT PRIMARY KEY, name TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
INSERT INTO pipelines VALUES ('<uuid fijo>', 'Ventas', 0, now, now);
ALTER TABLE stages ADD COLUMN pipeline_id TEXT NOT NULL DEFAULT '<uuid fijo>';
CREATE INDEX idx_stages_pipeline ON stages (pipeline_id, position);
```

El pipeline de un prospecto es el de su etapa (no se duplica en `prospects`).

`src/shared/consultora.ts`:

```ts
interface PipelineRef { id: string; name: string; position: number }
interface Stage { /* … */ pipelineId: string }
interface PipelineSummary extends PipelineRef { prospects: number; openValueUsd: number }
/** Tarjeta: prospecto + contacto principal + tags de sus contactos (para filtrar). */
interface ProspectCard extends Prospect { contact: { id: string; name: string } | null; tags: TagRef[] }
interface Pipeline { pipeline: PipelineRef; stages: (Stage & { prospects: ProspectCard[]; valueUsd: number })[]; openValueUsd: number }
interface PipelineInput { id?: string; name: string; stages?: (Partial<Stage> & { name: string; kind: StageKind })[] }
ProspectInput.pipeline?: string     // con `stage` opcional; sin etapa = primera abierta de ese pipeline

ConsultoraApi:
  listPipelines(): Promise<PipelineSummary[]>
  pipeline(ref?: string): Promise<Pipeline>                 // sin ref = el primero
  savePipeline(input: PipelineInput): Promise<Pipeline>     // crea o renombra + etapas (y movimientos)
  removePipeline(ref, moveTo?: { pipeline: string; stage?: string }): Promise<void>
  removeProspect(ref): Promise<void>
```

Filtros: función pura `filterProspects(cards, filters)` en `src/shared/pipeline-filters.ts` (el
pipeline completo ya viene en una llamada; uso personal).

## Servicio (`ProspectService` + `PipelineService` nuevo)

- `PipelineService.list/get/save/remove`. `save` reutiliza la lógica de `saveStages` por pipeline e
  incluye `moves: { from: stageId; to: stageId }[]` para columnas borradas con prospectos.
- `ProspectService.pipeline(ref)`: carga etapas del pipeline, prospectos y, en dos consultas, el
  contacto principal (primer contacto por `createdAt`) y los tags de los contactos.
- `insertProspect` acepta `pipeline`; `move` acepta etapa de otro pipeline (cambio de pipeline).
- `removeProspect`: `contacts.prospectId = null`, `meetings.prospectId = null`, borrar.
- `move` emite `prospect.stage_changed` con `kind` de la etapa destino.
- `Overview.pipeline` gana `pipeline: string`.

HTTP: `GET /pipelines`, `POST /pipelines`, `PATCH /pipelines/:ref`, `DELETE /pipelines/:ref`,
`GET /pipeline?pipeline=`, `DELETE /prospects/:ref`.

## UI

Estructura (atómica):

```
screens/Pipeline.tsx                       estado: pipelineId, view, filters, editorOpen
organisms/PipelineHeader                   selector · SegmentedToggle · FilterButton · Editar · Nuevo
organisms/PipelineBoard                    columnas (scroll x) + useBoardNav
molecules/BoardColumn                      cabecera (pill nombre + CountBadge, valor) · «+» · zona drop
molecules/ProspectCard                     empresa · valor · contacto · próximo paso
organisms/PipelineTable                    tabla ordenable (List + Row con columnas fijas)
organisms/PipelineFilters                  contenido del Drawer
organisms/PipelineEditorModal              nombre · lista de columnas (useReorder) · añadir · borrar
lib/useBoardNav.ts                         teclado + pulsación larga (HOLD_MS = 500)
```

`useBoardNav(ref)`:

- `keydown` en window (ignorado si el foco está en input/textarea/select o hay modal abierto):
  ← → hacen `scrollBy({ left: ±(anchoColumna + gap), behavior: 'smooth' })`; ⇧ al extremo.
- `pointerdown` en el fondo del contenedor (no sobre `[data-card]` ni botones): arranca un temporizador
  de `HOLD_MS`; si el puntero se mueve más de 6px antes, se cancela (no roba el scroll normal).
  Al cumplirse: `panning = true`, `setPointerCapture`, cursor `grabbing`, anillo apricot sutil en el
  contenedor (1.5px inset al 40%). `pointermove` ajusta `scrollLeft/scrollTop`. `pointerup` termina.
- `prefers-reduced-motion`: `behavior: 'auto'`.

Persistencia de pipeline y vista: `localStorage` (`pipeline.last`, `pipeline.view.<id>`), con
try/catch.

Brief impeccable (Operate), referencia Apollo adaptada a DESIGN.md:

- La tarea: ver dónde está cada oportunidad y moverla. La cabecera es una sola fila; los filtros no
  ocupan sitio hasta que se piden.
- Columnas: 260px, alto completo, fondo surface al 50%, cabecera con pill del nombre (won = mint,
  lost = milk-soft) y `CountBadge`; valor total a la derecha en micro. «+» quiet arriba de cada
  columna (como el «Add deal» de Apollo) que abre el input en línea dentro de la columna.
- Tarjeta: surface, radio sm, empresa en list bold, valor a la derecha en tabular, contacto en caption,
  próximo paso en micro (butter si vencido). Hover = un paso tonal.
- Lista: misma información en columnas fijas; la etapa como pill neutra; ordenar por cabecera con
  flecha; fila completa clicable.
- Editor: modal md; cada columna es una fila con asa de arrastre, nombre editable, rail de tres pills
  para el tipo y borrar. «Añadir columna» al pie. Guardar apricot, Cancelar quiet.
- Estados: pipeline vacío («Crea el primer prospecto» con «+»), filtros sin resultados (mensaje +
  «Limpiar filtros»), columna vacía (zona de soltar con texto milk-faint).

## MCP

`list_pipelines` · `get_pipeline { pipeline? }` · `save_pipeline { id?, name, stages? }` ·
`delete_pipeline { pipeline, move_to_pipeline?, move_to_stage?, confirm: true }` ·
`save_prospect { …, pipeline?, stage? }` · `move_prospect { prospect, stage, pipeline? }` ·
`delete_prospect { prospect, confirm: true }`.
