# Diseño · Canvas Improvement

## Principios

- Se conserva React Flow 12.12.0. La línea base no muestra una necesidad medida de cambiarlo.
- Lógica nueva en funciones puras con pruebas: ajuste, alineación, estilos y límites.
- Nodos con átomos y props; `BoardCanvas.tsx` no crece: los atajos y menús nuevos salen a hooks.
- El `.canvas` sigue siendo JSON Canvas 1.0. Lo propio va en `daylios`.

## Módulos

```
src/shared/
  canvas.ts            DayliosNodeMeta.style
  canvas-style.ts      nuevo: normalizar y validar TextStyle
src/renderer/src/consultora/workspace/board/
  viewport.ts          nuevo: MIN_ZOOM, MAX_ZOOM, DETAIL_ZOOM, NUDGE, NUDGE_BIG
  snap.ts              nuevo: ajuste a objetos y guías, puro
  align.ts             nuevo: alinear y distribuir, puro
  useBoardKeys.ts      nuevo: atajos fuera de BoardCanvas
  useBoardMenus.ts     nuevo: menús fuera de BoardCanvas
  SnapGuides.tsx       nuevo: líneas de guía
  context.ts           separar acciones estables de editingId
  nodes/
    CardText.tsx       edición con barra de formato
    FormatBar.tsx      nuevo
    PdfNode.tsx        nuevo
    DocPreview.tsx     nuevo: vista ampliada
    PreviewState.tsx   nuevo: carga, error, no encontrado, muy grande
scripts/perf/          nuevo: arnés, ver D5
src/test/
  board-flow.test.ts, board-ops.test.ts, board-history.test.ts
  board-snap.test.ts, board-align.test.ts, canvas-style.test.ts
```

## Viewport

- `minZoom 0.0625`, `maxZoom 2`.
- Grosor constante con la variable CSS `--ob-inv = 1 / zoom`: `stroke-width: calc(2px * var(--ob-inv))`,
  zona de clic de 24 px, rótulos con `scale(var(--ob-inv))`. Los marcadores de flecha usan
  `markerUnits="strokeWidth"` y siguen al trazo.
- `ZoomVar` escribe la variable solo en `.react-flow__edges`, `.react-flow__edgelabel-renderer` y
  `.react-flow__viewport-portal`. Medido con 1000 nodos en fit, p95 del zoom: variable en el
  contenedor 116.7 ms, en las capas de conexión 66.7 ms, al terminar el gesto 33.3 ms. Por eso se
  actualiza en cada frame hasta `LIVE_EDGES` 200 conexiones, sin coste medible en beta200, y 150 ms
  después del último cambio en boards mayores.

## Ajuste y alineación

```ts
interface Rect {
  id: string
  x: number
  y: number
  width: number
  height: number
}
interface Guide {
  axis: 'x' | 'y'
  at: number
  from: number
  to: number
}
function snapToObjects(
  moving: Rect,
  others: Rect[],
  threshold: number
): { x: number; y: number; guides: Guide[] }
function align(
  rects: Rect[],
  mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
): Rect[]
function distribute(rects: Rect[], axis: 'x' | 'y'): Rect[]
```

- Los objetos candidatos se calculan una vez al empezar el arrastre: nodos visibles que no se
  arrastran ni viajan dentro de un grupo.
- Umbral de 10 px de pantalla dividido por el zoom. Valor propio; el de Obsidian no se midió.
- El desplazamiento sale del nodo bajo el puntero y se aplica igual a toda la selección, así se
  conservan las distancias entre nodos. ⇧ lo reduce al eje dominante. ⌃ quita rejilla y objetos.
- Al soltar, React Flow manda su posición sin ajustar; se sustituye por la última ajustada.
- ⌥ y arrastrar: al soltar, los originales vuelven a su sitio y se pega una copia en el destino con
  las conexiones internas. Un solo paso de deshacer.
- `onSelectionDragStart` usa el mismo camino que `onNodeDragStart`.

## Estado y re-render

- `BoardContext` se divide en `BoardActions`, estable, y `useEditing(id)`, que devuelve un boolean
  por nodo. Solo re-renderizan el nodo que entra y el que sale de edición.
- Arrastre: se mantiene controlado. Solo si la tarea 0.2 mide caída con muchos nodos visibles se
  evalúa limitar `setNodes` a un frame o pasar a modo no controlado durante el arrastre.

## Texto

```ts
interface TextStyle {
  font?: 'sans' | 'serif' | 'mono'
  size?: number
  align?: 'left' | 'center' | 'right'
  lineHeight?: number
}
interface DayliosNodeMeta {
  kind: 'sticky' | 'text' | 'shape'
  shape?: ShapeKind
  style?: TextStyle
}
```

- Negrita y cursiva se escriben como markdown en `text`. Compatible con Obsidian.
- Fuente, tamaño, alineación e interlineado van en `daylios.style`. Valores admitidos fijos y
  validados en `canvas-style.ts`; lo inválido se descarta al parsear.
- Las fuentes se limitan a las pilas del sistema ya usadas por la app; sin fuentes nuevas.
- Editor: se mantiene el textarea y se añade `FormatBar`. Sin dependencias. La vista previa en vivo
  de Obsidian con CodeMirror 6 queda como mejora posterior si el usuario la pide.

## PDF y documentos

Opciones para el spike 0.5:

| criterio                   | A visor PDF de Chromium en iframe | B `pdfjs-dist`                          |
| -------------------------- | --------------------------------- | --------------------------------------- |
| dependencia nueva          | no                                | sí                                      |
| CSP                        | `frame-src vault:`                | `worker-src` para el worker             |
| control de carga y errores | bajo                              | alto                                    |
| miniatura en zoom alejado  | no                                | sí, bitmap en caché                     |
| aspecto                    | barra de Chromium                 | propio                                  |
| aislamiento                | proceso del visor                 | worker sin DOM; `isEvalSupported false` |

Decisión tras el spike, ver `spike-pdf.md`: **B, `pdfjs-dist` 6.4.299 exacto, compilación legacy**,
en `devDependencies`. Unos 18 MB por tarjeta frente a 115 MB del visor de Chromium, sin procesos
extra y con aspecto propio.

- Bytes por IPC: `workspace.readBytes(path)` en main con `vault.safe` y tope de tamaño. No se abre
  CORS en `vault`.
- `import()` diferido del módulo y del worker; no entra en el bundle inicial.
- `getDocument({ data, enableXfa: false })`. La opción `isEvalSupported` ya no existe en 6.x; la
  librería no usa `eval`. Sin scripting.
- Un solo `workerSrc` para todas las tarjetas; cada documento abierto se destruye al desmontar.
- Riesgo a verificar a mano: el worker de módulo se sirve desde `file://` en la app empaquetada. En
  el spike funcionó desde `file://`.

Comunes:

- `PdfNode` monta el visor solo si el nodo es visible y el zoom supera el umbral; al salir lo
  desmonta y deja la miniatura.
- `DocPreview` se abre en un portal fuera de React Flow. No toca nodos ni viewport, así que al
  cerrar todo sigue igual.
- Tamaño leído por IPC antes de cargar para aplicar el límite de R5.4.
- El handler de `vault` rechaza peticiones cuyo `Referer` u `Origin` sea `http` o `https`, para que
  una web incrustada no pueda sondear la bóveda.
- Web, D3: iframe con `sandbox` sin `allow-same-origin` ni `allow-top-navigation`,
  `referrerpolicy no-referrer`, solo `https:`. Alternativa más aislada: `WebContentsView` en main.

## Arnés de rendimiento

- `scripts/perf/` en TypeScript `.mts`, ejecutado por Node con eliminación de tipos, sin
  compilar: `meter.mts` medidor por rAF y longtask, `fixtures.mts` boards deterministas de 10, 200,
  1000 y 5000 nodos más `medios` e `interact`, `pdf.mts` genera PDFs de prueba sin binarios en el
  repo, `run.mts` el ejecutor.
- `npm run perf` construye y mide. Opciones: `--runs N`, `--sizes alfa10,beta200`,
  `--write-baseline`.
- Cada ejecución crea un `user-data-dir` temporal con su bóveda, lanza la app construida, mide y
  borra el temporal. Nunca toca los datos del usuario.
- Escenarios por board: abrir, encuadrar, pan y zoom en fit, arrastrar uno y arrastrar todo en
  fit, pan, arrastrar y escribir al 100 %, tiempo de guardado y memoria de todos los procesos.
- Resumen por mediana de las ejecuciones. Resultados en `scripts/perf/results/`, ignorado por git.
  `baseline.json` versionado. Sin `--write-baseline` compara con D6 y sale con código 1 si hay
  regresión.
- Límite: `performance.memory` de Chromium viene redondeado, por eso la memoria se mide con
  `app.getAppMetrics`.

## Pruebas

| tipo        | qué                                                                      | dónde                         |
| ----------- | ------------------------------------------------------------------------ | ----------------------------- |
| unidad      | flow, ops, history, snap, align, canvas-style, parse con `daylios.style` | `src/test`                    |
| integración | `applyBoardOps` con estilos; ida y vuelta Obsidian con fixtures          | `src/test`                    |
| unidad, ya  | `board-flow`, `board-ops`, `board-history`: 27 pruebas                   | `src/test`                    |
| interacción | atajos, ajuste, alinear, pegar sobre `interact.canvas`                   | `scripts/perf` con Playwright |
| visual      | capturas por escena contra Obsidian y contra la línea base               | `scripts/perf`                |
| rendimiento | escenarios de R6.2                                                       | `scripts/perf`                |
