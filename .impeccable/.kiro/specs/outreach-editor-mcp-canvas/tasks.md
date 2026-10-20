# Tareas

Cada bloque termina con `npm run check` en cero errores. Pruebas en `src/test` y ayudantes en `src/main/test`. Sin comentarios en código nuevo. No se crean ramas ni se hace commit.

## Fase 0 · Decisiones y spikes

- [x] 0.1 Dueño: D1 aprobada, dejar de enviar eventos y ocultar el nodo
- [x] 0.2 Dueño: D2 aprobada, editor sencillo
- [~] S1. Pendiente con la versión nueva instalada. Reproducir el fallo del MCP: ventana oculta, 20 minutos oculta y Cmd+Q. Anotar cuál falla
- [~] S2. Pendiente con cuenta real. Con una secuencia desechable, comprobar si Apollo deja editar pasos de una secuencia activa y si `PUT` con ids conserva el progreso
- [x] S3. Sustituido por la prueba de 150 nodos en `canvas-layout.test.ts`. Medir hoy un diagrama de 150 nodos con `board_edit` como línea base

## Fase 1 · Pie opcional y retiro de Secuencias

- [x] 1. Pie opcional en adaptador, servicio, estado, ajustes y MCP. Pruebas
- [x] 2. Eliminar la pantalla Secuencias y todo su recorrido: UI, contrato, IPC, rutas, servicio, MCP y pruebas
- [x] 3. Aplicar D1 en `marketing-sync`, `contact.service`, Worker y catálogo de automatizaciones. Pruebas

## Fase 2 · MCP estable

- [x] 4. Menú de app en macOS: Cmd+Q oculta. «Salir de Alisuite» en la bandeja con aviso
- [x] 5. `powerSaveBlocker` contra App Nap
- [x] 6. `GET /health` sin token
- [x] 7. Cliente MCP con timeout, reintento, apertura de la app y descarte de conexión vieja. Pruebas
- [x] 8. `openAtLogin` por defecto en la versión instalada: ya existía en `login-item.ts`

## Fase 3 · Boards grandes

- [x] 9. `validateBoardOps` con todos los errores y su índice. Pruebas
- [x] 10. `layoutNodes` con `flow-down`, `flow-right`, `tree` y `grid`, y lados de conexión. Pruebas sin solapes
- [x] 11. `board_edit` con `layout`, `response` compacta y 500 operaciones
- [x] 12. Herramienta `board_diagram`. Prueba de 150 nodos en menos de 3 segundos
- [x] 13. Recarga automática del board abierto cuando no hay cambios pendientes

## Fase 4 · Editor de secuencias

- [x] 14. Puertos con contenido de pasos y `archive`. Resend marca `archive` como no soportado
- [x] 15. Adaptador Apollo: `get` con contenido, `save` que conserva ids y `archive`. Fixture con el payload real
- [x] 16. Servicio, rutas, IPC, preload y MCP `get_outreach_sequence` y `archive_outreach_sequence`. Pruebas
- [x] 17. UI en diseño atómico: `HtmlPreview`, `StepEditor`, `StepPreview`, `SequenceEditor`, `SequenceViewer` y pantalla `OutreachSequence`
- [x] 18. Outreach: botón «Nueva secuencia», filas que abren el detalle y eliminar con confirmación

## Fase 5 · Cierre

- [x] 19. README, PRODUCT y specs anteriores al día
- [x] 20. `npm test` completo en la Mac y `npm run check`
- [ ] 21. Publicar versión 1.0.2

## Checklist con cuentas reales

- [ ] Con la ventana cerrada y tras 20 minutos, Claude crea una tarea
- [ ] Con Alisuite cerrada, una herramienta MCP la abre y responde
- [ ] Claude crea un diagrama de flujo de 50 pasos legible en una sola llamada
- [ ] Desde Outreach se crea una secuencia, se ve su contenido, se edita un paso y se archiva
- [ ] Las secuencias creadas ya no traen el pie duplicado
