# Diseño · Editor de outreach, MCP estable y boards grandes

## 1. Pie legal opcional

1. `ApolloSequenceOptions.footer` se mantiene. `withFooter` devuelve los pasos sin cambios cuando el pie está vacío.
2. `OutreachService.save` quita la validación del pie.
3. `OutreachStatus.hasFooter` se elimina del tipo, de la pantalla y de la herramienta MCP.
4. `ApolloSettings` cambia la ayuda del campo. Se recomienda vaciarlo en esta cuenta, porque las plantillas ya lo traen.

## 2. Retiro de la pantalla Secuencias

Se borra:

| Capa | Archivos |
| --- | --- |
| UI | `screens/Sequences.tsx`, entrada en `sections.ts`, `lib.ts` y `ConsultoraApp.tsx` |
| Contrato | `listSequences`, `setSequenceStatus` y tipos de secuencia de `@shared/marketing` que solo use esa pantalla |
| Main | `services/sequence.service.ts`, su uso en `marketing.ts`, IPC, rutas y controlador `/marketing/sequences` |
| MCP | `list_sequences`, `save_sequence`, `set_sequence_status` |
| Pruebas | `sequence.service.test.ts` y el tramo de secuencias de `marketing.routes.test.ts` |

Se conserva: newsletter, sincronización de contactos y segments, Worker, webhooks y correos de automatizaciones.

Con la recomendación de D1:

1. `marketing-sync` deja de procesar trabajos `event` y los descarta al leerlos.
2. `contact.service` deja de encolar eventos `tag.<slug>` y `lead.created`.
3. El Worker deja de llamar a `trigger`.
4. El nodo `start_sequence` se oculta del catálogo. Una automatización publicada que lo use marca el paso como omitido con el motivo «Las secuencias de Resend se retiraron».

## 3. MCP estable

### Causas probables y verificación

Spike S1 en la Mac del dueño, con medición:

1. Ocultar la ventana y llamar a `get_day`. Esperado: responde.
2. Ocultar la ventana 20 minutos y llamar de nuevo. Mide el efecto de App Nap.
3. Cmd+Q con la ventana Consultora al frente y llamar. Esperado hoy: falla con «no está abierto».

### Cambios

1. **Salida explícita.** En macOS se define un menú de app propio. «Cerrar» y Cmd+Q ocultan la ventana. La bandeja tiene «Salir de Alisuite», que muestra una notificación: «Claude no podrá usar Alisuite hasta que la abras».
2. **App Nap.** `powerSaveBlocker.start('prevent-app-suspension')` desde que el servidor arranca hasta `will-quit`.
3. **Cliente MCP.**
   - Timeout de 30 segundos por petición con `AbortSignal.timeout`, y un reintento ante errores de red.
   - Si la conexión falla, abre la app: `open -b` con `APP_ID` de `@shared/app` en macOS y el ejecutable instalado en Windows. Espera hasta 20 segundos a un `connection.json` con fecha nueva y un `GET /health` que responda.
   - El id de bundle y la ruta del ejecutable salen de `@shared/app`, sin rutas fijas.
4. **Salud.** `GET /health` sin token devuelve versión y pid. Sirve para descartar un `connection.json` viejo.
5. **Inicio de sesión.** En el primer arranque de la versión instalada, `openAtLogin` se activa si nunca se tocó.

## 4. Boards grandes

### Nuevas piezas en `src/shared/canvas.ts`

```ts
export type BoardLayout = 'flow-down' | 'flow-right' | 'tree' | 'grid'

export interface BoardEditOptions {
  layout?: BoardLayout
  response?: 'compact' | 'full'
}

export function validateBoardOps(canvas: CanvasFile, ops: BoardOp[]): { index: number; message: string }[]
export function layoutNodes(nodes: CanvasNode[], edges: CanvasEdge[], ids: string[], layout: BoardLayout): void
```

1. `validateBoardOps` simula las operaciones sobre una copia y junta todos los errores. `applyBoardOps` solo corre si no hay errores.
2. `layoutNodes` ordena solo los nodos creados en la llamada que no traían posición:
   - `flow-down` y `flow-right`: capas por recorrido en anchura desde los nodos sin entradas, con separación fija y centrado por capa.
   - `tree`: igual, con hijos centrados bajo su padre.
   - `grid`: filas de raíz cuadrada del total.
   - El bloque nuevo se coloca a la derecha de lo existente, sin pisarlo.
3. Las conexiones creadas reciben `fromSide` y `toSide` según el layout: abajo y arriba para `flow-down`, derecha e izquierda para `flow-right`.
4. Sin dependencias nuevas. Si el spike muestra cruces feos con más de 100 nodos, se evalúa `dagre` en una tarea aparte.

### Herramientas MCP

1. `board_edit` suma `layout` y `response`. Límite de 500 operaciones.
2. Nueva `board_diagram`: recibe `nodes: [{ id, text, shape }]` y `edges: [{ from, to, label }]` y arma las operaciones con `layout` por defecto `flow-down`.
3. La respuesta compacta es `{ created, nodes, edges, errors }` con conteos, sin textos.
4. La descripción de las herramientas explica cuándo usar cada una y que para más de 500 elementos se parta en varias llamadas.

### Recarga en la app

1. El servicio de workspace ya emite cambios de datos. `BoardPane` escucha los cambios del board abierto.
2. Si no hay escritura pendiente ni conflicto, recarga el board en sitio y conserva la vista.
3. Si hay cambios sin guardar, se mantiene el aviso de conflicto actual.

## 5. Editor de secuencias en Outreach

### Puertos

`RemoteSequenceDetail.steps` pasa a llevar contenido:

```ts
export interface RemoteSequenceStepContent {
  id: string
  position: number
  wait: string
  subject: string
  html: string
  thread: 'new' | 'reply'
  touchId?: string
  templateId?: string
}
```

`SequenceStep` suma `id`, `touchId` y `templateId` opcionales para editar en sitio. `SequenceEngine` suma `archive(id): Promise<void>`. Resend lo marca como no soportado.

### Adaptador Apollo

1. `get` cruza `emailer_steps`, `emailer_touches` y `emailer_templates` de `GET /emailer_campaigns/{id}`, ya verificado con la cuenta real.
2. `save` con id manda `PUT /sequences/{id}` con cada paso existente con su `id`, su toque con `id` y la plantilla con `id`. Los pasos nuevos van sin id y los omitidos se borran, como define el diff declarativo de Apollo.
3. `archive` llama `POST /emailer_campaigns/{id}/archive`.
4. Las esperas se leen de `wait_time` y `wait_mode`, y la del primer paso se fija en cero.

### Servicio y API

1. `OutreachService.get` devuelve el detalle con contenido.
2. `OutreachService.save` acepta pasos con ids y valida igual que hoy, sin el pie.
3. `OutreachService.archive(id, confirm)` exige confirmación.
4. Rutas nuevas: `GET /marketing/outreach/sequences/:id` con contenido y `POST /marketing/outreach/sequences/:id/archive`. IPC y preload equivalentes.
5. MCP: `get_outreach_sequence` y `archive_outreach_sequence`.

### Interfaz, diseño atómico

| Nivel | Componente | Props principales |
| --- | --- | --- |
| Átomo | `HtmlPreview` | `html` |
| Molécula | `StepEditor` | `step`, `index`, `onChange`, `onRemove`, `onMove` |
| Molécula | `StepPreview` | `step`, `index` |
| Organismo | `SequenceEditor` | `value`, `onChange`, `onSave`, `saving` |
| Organismo | `SequenceViewer` | `sequence`, `onEdit`, `onArchive` |
| Pantalla | `OutreachSequence` | `id` o `new` |

1. `HtmlPreview` usa un `iframe` con `srcdoc` y `sandbox` vacío: no hay scripts ni navegación.
2. El cuerpo se edita según D2.
3. La pantalla Outreach suma «Nueva secuencia» y cada fila abre su detalle.
4. Eliminar pide una segunda confirmación en sitio, igual que activar.

## Pruebas

1. Pie vacío no se añade y la creación funciona sin pie.
2. Retiro de secuencias: el resto de las suites de marketing pasan. Si se aplica D1, un trabajo `event` viejo se descarta sin error.
3. MCP: cliente con `fetch` falso que primero falla y luego responde, apertura de la app simulada, `connection.json` viejo descartado por la salud.
4. Boards: validación con varios errores e índices, cada layout sin solapes, `board_diagram` de 150 nodos en menos de 3 segundos, respuesta compacta.
5. Apollo: `get` con el payload real guardado como fixture, `save` de edición que conserva ids, `archive`.
6. Outreach: archivar exige confirmación y la secuencia archivada no aparece.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Apollo no deja editar una secuencia activa | Spike S2. Si lo rechaza, la UI pide pausar antes de guardar |
| Editar texto de un paso cambia lo que reciben inscritos a medio camino | Aviso de R5.5 |
| Abrir la app desde el MCP en Windows | La ruta del ejecutable viene del registro de instalación de NSIS. Se prueba en el checklist de Windows |
| El layout propio no basta para grafos muy densos | Tarea opcional con `dagre` |
