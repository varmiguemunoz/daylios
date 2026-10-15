# Tareas · A3 Dashboard configurable

## Fase 1 · Datos

- [x] 1. Migración `prospect_stage_events`, `prospects.closed_at` y `dashboards`, con relleno de
      `closed_at`.
- [x] 2. `ProspectService.move` y la creación escriben el evento y `closed_at`. Pruebas.
- [x] 3. Tipos `MetricsQuery`, `MetricsResult`, `DashboardLayout` y `WidgetPlacement` en
      `src/shared/metrics.ts`.

## Fase 2 · Métricas

- [x] 4. `metrics.service.ts` con las funciones puras y `query`. Pruebas por indicador y periodo.
- [x] 5. `DashboardService` con leer, guardar y restablecer, validando el diseño.
- [x] 6. Rutas, IPC y preload.

## Fase 3 · Interfaz

- [x] 7. Átomos `StatValue` y `Delta`; moléculas `BarList`, `Sparkline` y `MiniTable`.
- [x] 8. `WidgetFrame`, `widgets/registry.ts` y los seis componentes obligatorios.
- [x] 9. Componentes adicionales del catálogo.
- [x] 10. Sección «Inicio», selectores de periodo y pipeline, `DashboardGrid`.
- [x] 11. Modo edición: catálogo, quitar, reordenar, tamaño y ajustes por componente.
- [x] 12. Clic en un indicador abre su origen filtrado.

## Fase 4 · Claude y cierre

- [x] 13. MCP `get_metrics`.
- [x] 14. Revisión estática; DESIGN.md con el patrón de componentes, README.

## Checklist

- [ ] Abro Inicio y veo tareas abiertas y cerradas, pipeline abierto, ganados, perdidos y valor por
      etapa
- [ ] Muevo un prospecto a Ganado y el componente sube sin recargar
- [ ] Quito un componente, añado «Tasa de cierre», lo pongo a medio ancho y al reiniciar sigue igual
- [ ] Cambio a Este mes y todo se recalcula con la comparación
- [ ] Clic en Atrasadas me lleva a Tareas filtradas
- [ ] Claude responde «cuánto gané este mes» con los mismos números

## Notas de la implementación

- Ajustes por componente: periodo, rango y pipeline. Tag y estado quedan para una versión siguiente.
- Los movimientos masivos al borrar una etapa o un pipeline no escriben evento; solo `move` y la creación.
- Arrastrar usa `useReorder`, pensado para listas verticales: en la rejilla funciona por mitades de cada tarjeta.
