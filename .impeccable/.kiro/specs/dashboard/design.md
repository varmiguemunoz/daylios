# Diseño · A3 Dashboard configurable

Brief según impeccable `shape`. Modo: **Monitor**. El dueño abre la app y en cinco segundos sabe si
la semana va bien, qué está atrasado y cuánto hay en juego. Para los gráficos se sigue la skill
`dataviz`: formas simples, la paleta de Obsidian, etiquetas directas y tabla equivalente.

## 1 · Datos

- **`prospect_stage_events`**: `id`, `prospect_id`, `from_stage_id`, `to_stage_id`, `to_kind`,
  `value_usd` en ese momento y `at`. Lo escribe `ProspectService.move` y la creación.
- **`prospects.closed_at`**: fecha de entrada a ganado o perdido; se borra si vuelve a abierta.
- **`dashboards`**: `id`, `name`, `owner`, `layout` en JSON, `updated_at`. Una fila por defecto.

`DashboardLayout = { version: 1, widgets: WidgetPlacement[] }` y
`WidgetPlacement = { id, kind, size: 'quarter' | 'half' | 'full', rows: 1 | 2, settings }`.

## 2 · Métricas

`services/metrics.service.ts` con funciones puras por indicador, probadas sin base de datos:
`taskCounts`, `tasksByStatus`, `openPipelineValue`, `wonLost`, `valueByStage`, `winRate`,
`overdue`, `meetingsThisWeek`, `openActionItems`, `contactGrowth`.

Una sola llamada `metrics.query({ period, compare, pipeline, kinds })` devuelve solo los
indicadores pedidos, cada uno con su valor, su comparación y sus filas de detalle. Así el dashboard
hace una petición por cambio y Claude usa la misma.

## 3 · Interfaz

```
Inicio                         [Esta semana ▾] [Todos los pipelines ▾] [Editar dashboard]

┌ Tareas abiertas ┐┌ Cerradas ───────┐┌ Pipeline abierto ┐┌ Ganados ───────┐
│ 14              ││ 9  ▲ 3          ││ $48.200          ││ 2 · $12.000    │
└─────────────────┘└─────────────────┘└──────────────────┘└────────────────┘
┌ Valor por etapa ─────────────────────┐┌ Atrasadas ──────────────────────┐
│ Contacto ████████ $20k               ││ Propuesta Acme · hace 2 días    │
│ Propuesta █████ $14k                 ││ Llamar a Byou · ayer            │
└──────────────────────────────────────┘└─────────────────────────────────┘
```

- **Rejilla:** CSS grid de 4 columnas que pasa a 2 en paneles estrechos. Sin librerías nuevas:
  reordenar usa el `useReorder` existente.
- **Átomos:** `StatValue` y `Delta`, con flecha y color según sube o baja.
- **Moléculas:** `BarList`, `Sparkline` y `MiniTable`, en SVG propio.
- **Organismos:** `WidgetFrame` con título, menú, estados y ajustes; `WidgetCatalog` como modal;
  `DashboardGrid`.
- **Registro:** `widgets/registry.ts` asocia cada `kind` con su componente, sus ajustes, su tamaño
  por defecto y los indicadores que pide. Añadir un componente nuevo es añadir una entrada.

## 4 · Claude

`get_metrics` con `period`, `from`, `to` y `pipeline`, que devuelve los mismos números y filas.

## 5 · Riesgos

- Ganados y perdidos antiguos sin evento: se usa `updatedAt` y se avisa con una nota al pie del
  componente la primera semana.
- Un periodo largo con mucho historial: los cálculos usan índices por fecha y agregados en SQL.
