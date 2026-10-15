# Tareas · Canvas Improvement

Estimación relativa: S pequeña, M media, L grande. Prioridad: P0 imprescindible, P1 importante,
P2 opcional. Cada tarea termina con `npm run check` sin errores.

## Fase 0 · Auditoría y línea base

- [x] 0.1 Arnés en `scripts/perf/` con generador de fixtures de 10, 200, 1000 y 5000;
  `playwright-core` 1.48.2 exacto; `npm run perf`. M · P0 · R6.1
- [x] 0.2 Escenarios: abrir, fit, pan, zoom, arrastrar uno y todo en fit, pan, arrastrar y escribir
  al 100 %, guardado, memoria. `baseline.json` con 3 ejecuciones. M · P0 · R6.2
- [x] 0.3 27 pruebas de `flow.ts`, `ops.ts` y `history.ts`. `history.ts` separa la pila pura del
  hook para poder probarla. M · P0
- [x] 0.4 Descartada por D2: se mantienen las barras grises.
- [x] 0.5 Spike PDF: gana `pdfjs-dist` 6.4.299 legacy. Ver `spike-pdf.md`. M · P0 · D4
- [ ] 0.6 Capturas de referencia de Obsidian y DayliOS por escena. S · P1 · tras 0.1

## Fase 1 · Fundamentos de interacción

- [x] 1.1 `viewport.ts` con constantes; zoom 0.0625 a 2. S · P0 · R1.1, R1.5
- [x] 1.2 Conexiones de 2 px y zona de clic de 24 px en pantalla; rótulos de tamaño constante. Una
  variable CSS `--ob-inv` que actualiza `ZoomVar` sin re-renderizar nodos. S · P0 · R1.2, R1.3
- [x] 1.3 `BoardContext` con acciones estables y `useEditing(id)` sobre un store externo: solo
  re-renderiza el nodo que entra o sale de edición. S · P1
- [x] 1.4 `useBoardKeys`, `useModifiers` y `menus.ts` fuera de `BoardCanvas`. M · P0
- [x] 1.5 Flechas 20 y 100; ⌘Y rehace. S · P1 · R2.1
- [x] 1.6 `snap.ts` con pruebas, `SnapGuides`, opciones Ajustar a la rejilla y Ajustar a objetos en el
  menú del fondo. Umbral de 10 px de pantalla, valor propio. M · P0 · R2.2
- [x] 1.7 ⌃ desactiva rejilla y objetos; ⇧ fija el eje. El desplazamiento se calcula desde el nodo bajo
  el puntero. S · P1 · R2.3, R2.4
- [x] 1.8 ⌥ y arrastrar clona: el original vuelve a su sitio con sus conexiones y la copia queda donde
  se suelta, con las conexiones internas. S · P1 · R2.5
- [x] 1.9 `align.ts` con pruebas y menú Alinear con 6 alineaciones y 2 distribuciones. M · P1 · R2.6
- [x] 1.10 Pegar en el puntero, ajustado a la rejilla como el resto de inserciones. S · P2 · R2.8
- [x] 1.11 Menú del fondo, de tarjeta y de conexión; Añadir página web; Convertir en nota; Seguir
  conexión va al destino; doble clic en una conexión edita el rótulo; Solo lectura por board. M · P1 ·
  R2.9
- [x] 1.11b `scripts/perf/interact.mts`, `npm run perf:interact`: 15 comprobaciones sobre
  `interact.canvas` leyendo el archivo guardado. 15 de 15 bien. S · P0
- [x] 1.12 Medido. Con el mismo número de nodos visibles, todo dentro de D6. Con zoom 0.0625 el
  encuadre de 1000 y 5000 nodos muestra el doble de nodos y baja: pan p95 33 ms, arrastrar uno 51 ms.
  Sigue por encima de Obsidian en el mismo caso. `baseline-fase0.json` guarda la línea base previa.
  El arnés lanza Electron sin ahorro de ventanas tapadas, que antes dejaba nodos sin medir.

## Fase 2 · Fidelidad visual

- [x] 2.1 Tokens de Obsidian en `.ob-canvas`: fondo, puntos, borde de tarjeta, relleno, selección,
  color al 70 % con línea interior, conexiones y rótulos. Sin sombra de tarjeta por rendimiento.
  S · P0 · R3.1
- [x] 2.2 Marco del área y caja de selección múltiple. S · P1 · R2.7
- [x] 2.3 Las esquinas cuadradas eran el anillo de foco del nodo; se oculta en nodos y conexiones.
  S · P1 · R3.3
- [x] 2.4 Rótulo de grupo y fondo con imagen, Cubrir, Ajustar o Repetir desde la barra. M · P1 · R3.2
- [x] 2.5 Sin cambios: las barras grises ya funcionan con el nuevo zoom. S · P2 · R1.4
- [x] 2.6 Controles: ajustes, zoom al 100 % y atajos; el minimapa se queda. S · P2
- [x] 2.7 DESIGN.md al día. S · P0
- [ ] 2.8 Revisión visual a mano contra Obsidian. S · P0

## Fase 3 · Edición de contenido

- [x] 3.1 `TextStyle` en `shared/canvas-style.ts`; `parseCanvas` descarta valores inválidos;
  `kind` de la meta pasa a opcional para no marcar tarjetas de Obsidian. S · P0 · R4.3
- [x] 3.2 `FormatBar` bajo la tarjeta: negrita y cursiva como markdown, Sans, Serif o Mono, tamaños
  12 a 40, alineación e interlineado 1.2, 1.5 o 2; ⌘B y ⌘I. Los botones no roban el foco. M · P0 ·
  R4.2, R4.4
- [x] 3.3 Estilo aplicado con variables CSS en vista, edición y barras grises. S · P0
- [x] 3.4 Cada cambio de estilo pasa por `patch`: deshacer y autoguardado sin código nuevo. S · P0 ·
  R4.5, R4.6
- [x] 3.5 `applyBoardOps` ya no pierde la meta al cambiar la forma. Error real corregido. S · P1 ·
  R4.7
- [x] 3.6 Pruebas de ida y vuelta en `canvas-style.test.ts`. Falta abrir un board con estilos en
  Obsidian a mano. S · P0

## Fase 4 · Preview de documentos

- [x] 4.1 `pdfjs-dist` 6.4.299 exacto en devDependencies, compilación legacy, chunk diferido.
  `workspace.fileBytes` por IPC con `vault.safe` y tope `PREVIEW_MAX_BYTES` de 50 MB, valor propio.
  CSP `worker-src 'self'` y `frame-src https:`. S · P0 · R5.7
- [x] 4.1b `vault-guard.ts`: `vault://` responde 403 si el origen o el referrer es una web. Riesgo que
  queda: una web con `no-referrer` puede comprobar si existe un archivo, no leerlo. S · P0 · R5.7
- [x] 4.2 `PreviewState` con carga, no encontrado, demasiado grande con Abrir fuera, y error con
  Reintentar. S · P0 · R5.3, R5.4
- [x] 4.3 `PdfNode`: página a la resolución de la tarjeta, doble resolución desde zoom 1,
  paginación, miniatura en caché para el zoom alejado; no carga nada bajo `DETAIL_ZOOM`. M · P0 ·
  R5.1, R5.5
- [x] 4.4 `DocPreview` en portal con todas las páginas, carga perezosa, zoom de 50 a 200 % y Abrir
  fuera. No toca nodos ni viewport. M · P0 · R5.2
- [x] 4.5 Nota con `subpath`: `shared/note-section.ts` con pruebas. S · P2 · R5.8
- [x] 4.6 `LinkNode` con la web en vivo en un iframe con `sandbox` sin popups ni navegación del
  padre, `no-referrer`, solo https. Cabecera con host y Abrir en el navegador como respaldo si el
  sitio no se deja incrustar. Una capa encima mientras no está seleccionada para poder moverla. M ·
  P1 · R5.9
- [ ] 4.7 Medir pan y zoom con 10 PDFs visibles. Pendiente, sin ejecutar por decisión del usuario.
  S · P0 · R5.6

## Fase 5 · Optimización

Solo lo que las mediciones de 0.2, 1.12 y 4.7 justifiquen.

- [x] 5.1 Primer paso sin perfilar: `sameNode` hace que el contenido de un nodo no se vuelva a
  pintar cuando solo cambia su posición. Falta medir el efecto con `npm run perf`. M · P0 · H17
- [ ] 5.2 Historial por diferencias si la memoria medida lo pide. M · P2
- [ ] 5.3 Guardado de boards grandes si 0.2 muestra longtask. S · P2

## Fase 6 · Validación

- [ ] 6.1 Arnés completo contra `baseline.json` dentro de la tolerancia D6. Lo lanza el usuario con
  `npm run perf` y `npm run perf:interact`. S · P0
- [x] 6.2 `npm test`: 51 archivos, 351 pruebas en verde. S · P0
- [ ] 6.3 impeccable `critique` del board y un lote de correcciones. M · P1
- [ ] 6.4 Checklist manual. S · P0

## Riesgos

| riesgo | mitigación |
|---|---|
| romper compatibilidad con Obsidian | ida y vuelta con fixtures en 3.6 y prueba de campos extra |
| regresión en grupos y portapapeles | pruebas de 0.3 antes de tocar nada |
| PDF lento o pesado en memoria | spike 0.5, montaje por visibilidad, límite de tamaño |
| web externa con acceso a la app | iframe con sandbox o D3 negativo |
| cambiar atajos que el usuario ya usa | D1 explícita; ⌘D se mantiene |
| mediciones con ruido | dos ejecuciones por escenario y misma ventana |

## Definición de hecho

- Requisitos de la fase con aceptación verificada.
- `npm run check` limpio y `npm test` en verde.
- Arnés sin regresión fuera de D6.
- `.canvas` abre en Obsidian sin pérdidas.
- DESIGN.md al día.

## Checklist

- [ ] ⇧1 en el board grande muestra los 1000 nodos
- [ ] Las conexiones se ven igual de finas a 10 % y a 200 %
- [ ] Arrastro una tarjeta cerca de otra y se alinea con guía
- [ ] Alineo 5 tarjetas a la izquierda y las distribuyo
- [ ] Pongo negrita y tamaño 20 a una tarjeta, cierro la app y sigue igual
- [ ] Abro ese board en Obsidian y se ve la negrita
- [ ] Veo un PDF en su tarjeta, lo amplío, cierro y el board sigue donde estaba
- [ ] Un PDF borrado muestra error sin romper el board
