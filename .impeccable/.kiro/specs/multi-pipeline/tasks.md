# Tareas · Pipelines

- [x] 1. Migración `AddPipelines` + `PipelineModel`; `pipelineId` en `StageModel` y tipos
- [x] 2. `PipelineService` (list, get, save con movimientos, remove); `ProspectService.pipeline(ref)`
      con contacto principal y tags; `insertProspect.pipeline`; `move` entre pipelines;
      `removeProspect`; `Overview` por pipeline
- [x] 3. `filterProspects` pura + tests (búsqueda, tags, tipo de etapa, vencido, valor mínimo)
- [x] 4. Rutas, IPC, preload
- [x] 5. UI: `PipelineHeader`, `PipelineBoard` + `BoardColumn` + `ProspectCard` (con «+» por columna)
- [x] 6. UI: `PipelineTable` (ordenar, cambiar etapa en línea)
- [x] 7. UI: `PipelineFilters` en `Drawer`
- [x] 8. UI: `PipelineEditorModal`; quitar etapas de Ajustes
- [x] 9. `useBoardNav` (teclado + pulsación de 500 ms para arrastrar la vista)
- [x] 10. Ficha de prospecto: cambiar de pipeline, borrar
- [x] 11. MCP: `list_pipelines`, `get_pipeline`, `save_pipeline`, `delete_pipeline`,
      `delete_prospect`, `pipeline` en `save_prospect`/`move_prospect`
- [x] 12. impeccable `critique` del tablero y la lista; corregir en un lote
- [x] 13. DESIGN.md: pipeline (tablero, lista, editor, panel)

## Checklist

- [ ] Tras migrar veo «Ventas» con mis etapas y prospectos de siempre
- [ ] Creo «Outbound» con 5 columnas desde «Editar pipeline» y cambio entre los dos con el selector
- [ ] ← / → recorren columnas; mantener 500 ms sobre el fondo y arrastrar mueve la vista; arrastrar una
      tarjeta sigue cambiando su etapa
- [ ] Borro una columna con 2 prospectos y elijo moverlos a otra
