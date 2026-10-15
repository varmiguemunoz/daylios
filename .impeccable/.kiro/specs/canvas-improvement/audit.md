# Auditoría · Canvas Board de DayliOS

Equivale a `research/current-canvas-audit.md`. Estado del código al 14 de octubre de 2026. No se
modificó código del board.

## 1. Arquitectura actual

| capa | archivo | papel |
|---|---|---|
| formato | `src/shared/canvas.ts` | tipos JSON Canvas con meta `daylios`, parse, serialize, `applyBoardOps` para MCP |
| grupos | `src/shared/canvas-groups.ts` | `groupAround`, `childrenOf`, `groupZ` |
| adaptador | `board/flow.ts` | JSON Canvas a React Flow y vuelta; `canvasOf` conserva campos extra |
| lógica | `board/ops.ts`, `board/history.ts` | pasajeros de grupo, portapapeles, pila de 60 instantáneas |
| vista | `board/BoardCanvas.tsx`, 750 líneas | React Flow 12.12.0 controlado, atajos, menús |
| nodos | `board/nodes/*` | tarjeta, texto, forma, imagen, nota, archivo, enlace, grupo |
| pantalla | `workspace/screens/BoardPane.tsx` | carga, guardado a 500 ms, conflicto por `modifiedAt` |
| main | `src/main/index.ts` | protocolo `vault://` con `vault.safe` para rutas |

Dependencias presentes que sirven: `@xyflow/react`, `react-markdown`, `remark-gfm`. No hay
`pdfjs-dist`, CodeMirror, TipTap ni Playwright en `package.json`.

## 2. Pruebas

- `src/test/canvas.test.ts` y `canvas-groups.test.ts`: 10 pruebas, todas pasan.
- Sin pruebas para `flow.ts`, `ops.ts`, `history.ts` ni el componente. Riesgo de regresión alto
  en cualquier refactor del board.

## 3. Línea base de rendimiento

Mismo arnés y mismos fixtures que Obsidian, ventana de 1024 por 800, app construida con
`electron-vite build`. Script: `.rea-evidence/obsidian/dayli-perf.mjs.txt`. Dos ejecuciones:
`dayli-run1.jsonl` en frío y `dayli.jsonl` con viewport ya guardado.

| board | primer nodo ms r1, r2 | DOM en fit | escala fit | pan fit fps | zoom fit fps | DOM al 100 % | pan 100 | drag 100 |
|---|---|---|---|---|---|---|---|---|
| pequeño | 164, 47 | 15 | 0.319 | 60 | 60 | 8 | 60 | 57.6 con un frame de 100 ms, luego 60 |
| mediano | 178, 127 | 200 | 0.133 | 60 | 60 | 12 | 60 | 60 |
| grande | 581, 378 | 748 de 1000 | 0.1, tope | 54.6 y 53.1, p95 33.3 | 55.5 y 52.6, p95 33.3 | 16 | 60 | 60 |

Lectura:

- Con hasta 200 nodos y al 100 % no hay caída medible.
- En grande y alejado el p95 sube a 33 ms, un frame perdido de cada dos en el peor 5 %. Obsidian en
  el mismo caso tuvo p95 de 50 ms, pero mostraba 1000 nodos a 0.0625 y DayliOS 748 a 0.1. No es
  comparable de forma directa.
- El escenario drag mueve un solo nodo con pocos nodos en el DOM. No mide el coste del estado
  controlado con muchos nodos visibles. Falta medirlo.
- No se midió memoria, tamaño del JSON guardado ni coste del guardado de grande.

### 3.1 Línea base del arnés, `scripts/perf/baseline.json`

`npm run perf` con 3 ejecuciones en frío, mediana, ventana de 1024 por 800, 0 ejecuciones fallidas.

| board | primer nodo ms | DOM en fit | pan fit p95 | arrastrar uno en fit p95 | arrastrar todo en fit | pan 100 p95 | escribir p95 | guardado ms |
|---|---|---|---|---|---|---|---|---|
| alfa10 | 101 | 10 | 17.4 | 17.4 | 60 fps, p95 17.1 | 17.6 | 17.4 | 520 |
| beta200 | 173 | 200 | 16.8 | 16.8 | 60 fps, p95 16.9 | 17.2 | 17.3 | 516 |
| gamma1000 | 456 | 468 | 17.3 | 17.4 | **28.9 fps, p95 83.4, 30 longtasks** | 17.6 | 17.6 | 515 |
| delta5000 | 1680 | 475 | 17.5 | 17.7 | **9.7 fps, p95 317.6, peor frame 1367 ms** | 17.5 | 17.6 | 534 |

- Guardado: 500 ms de espera más unos 15 a 35 ms de escritura.
- Memoria total de procesos entre 650 y 1250 MB según board y momento; varía mucho entre
  ejecuciones y no sirve como criterio fino.
- Con 1000 o más nodos, encuadrar se queda en 0.1 y deja fuera más de la mitad del board.

## 4. Hallazgos

Severidad: A alta, M media, B baja.

| id | sev | hallazgo | evidencia | causa |
|---|---|---|---|---|
| H1 | A | Encuadrar no muestra el board grande completo | `q-grande-fit.png`, DOM 748 de 1000 | `minZoom 0.1`; Obsidian baja a 0.0625 |
| H2 | A | El PDF no se previsualiza, solo icono y nombre | `q-pequeno-fit.png`, `FileNodes.tsx` | `FileNode` no tiene visor |
| H3 | A | Editar texto es un textarea sin formato ni estilos | `q-visual-editing.png`, `CardText.tsx` | diseño inicial W3 |
| H4 | M | Las conexiones engordan con el zoom: muy gruesas al 251 % | `q-visual-100.png` | trazo de 2 px dentro del viewport transformado |
| H5 | M | Zoom a selección llega a 251 %, Obsidian para en 200 % | `q-visual-100.png` | `maxZoom 3` |
| H6 | M | Esquinas cuadradas de acento en la tarjeta seleccionada | `q-visual-100.png` | [H] manejadores de esquina de `NodeResizer` |
| H7 | M | Un enlace no muestra la web, solo host y URL | `FileNodes.tsx` | `LinkNode` simple |
| H8 | M | La CSP no declara `frame-src`; cae en `default-src 'self'` | `src/renderer/index.html` | [H] bloquearía iframes de `vault:` y `https:` |
| H9 | M | Cada movimiento de arrastre pasa por `setNodes` y re-renderiza `BoardCanvas` | `BoardCanvas.tsx` | flujo controlado; coste no medido con muchos nodos visibles |
| H10 | M | Cambiar `editingId` cambia el valor de `BoardContext` y re-renderiza todos los nodos que usan `useBoard` | `board/context.ts` | contexto único con datos y acciones |
| H11 | M | Sin ajuste a objetos ni guías | `BoardCanvas.tsx` | solo `snapToGrid` |
| H12 | B | Flechas mueven 1 y 10; Obsidian 20 y 100 | `BoardCanvas.tsx` | decisión W3 |
| H13 | B | `subpath`, `background` y `backgroundStyle` se conservan pero no se pintan | `flow.ts`, `GroupNode.tsx` | sin soporte en vista |
| H14 | B | `disableKeyboardA11y` quita la navegación por teclado de React Flow | `BoardCanvas.tsx` | prop activada |
| H15 | B | Historial guarda arrays completos, 60 por board | `history.ts` | memoria O de 60 por n; no medida |
| H16 | B | Ventanas con `sandbox: false` | `consultora-window.ts`, `window.ts` | condiciona cómo incrustar web externa |
| H17 | A | Arrastrar muchos nodos seleccionados se congela: 29 fps con 1000, 10 fps con 5000 | `baseline.json`, `dragAllFit` | [H] H9: cada movimiento genera un cambio por nodo seleccionado y re-render de nodos y conexiones; falta perfilar |

## 5. Límites de la edición de texto

- Se edita el markdown crudo; al salir se renderiza con `Markdown`.
- No hay negrita ni cursiva por botón, ni fuente, tamaño, alineación o interlineado.
- Escape y blur confirman. No hay cancelar.
- Con zoom menor a 0.45 se ven barras grises, `DETAIL_ZOOM`.

## 6. Riesgos de regresión

- Compatibilidad del `.canvas` con Obsidian y con `applyBoardOps` del MCP.
- Pasajeros de grupo al mover y al borrar.
- Guardado diferido, conflicto y guardado al desmontar.
- Viewport guardado en `uiState` por board.
- Atajos que ya usa el usuario: ⌘D duplicar, ⌥ colocación libre.
- Nodos propios de DayliOS: adhesiva, texto libre y formas.

## 7. Seguridad

- `vault://` resuelve rutas con `vault.safe`, que limita a la bóveda.
- No hay iframes ni `webview` en el board hoy.
- Cualquier preview de web externa necesita aislamiento propio porque las ventanas no usan sandbox.
