# Requisitos · Canvas Improvement

Basado en `research-obsidian.md`, `audit.md` y `comparison.md`. Cada requisito indica su origen:
**Obsidian** si replica algo observado o documentado, **DayliOS** si es extensión propia.

## Objetivos

1. Que el board se use y se vea como Obsidian Canvas sin perder lo que DayliOS ya hace.
2. Editar texto dentro de la tarjeta con formato y estilos que persisten.
3. Ver PDFs y documentos dentro del board sin bloquearlo.
4. Medir antes y después de cada fase con pruebas reproducibles.

## Fuera de alcance

- Cambiar React Flow u otra dependencia del board sin una medición que lo pida.
- Tema claro del board.
- Colaboración en tiempo real sobre el board.

## R1 · Viewport. Obsidian

- R1.1 Zoom entre 0.0625 y 2.
- R1.2 Las conexiones miden 2 px en pantalla a cualquier zoom, con zona de clic de unos 24 px.
- R1.3 Etiquetas de conexión y de archivo mantienen tamaño de pantalla.
- R1.4 Bajo `DETAIL_ZOOM` 0.45 las tarjetas muestran barras grises en lugar del contenido. DayliOS,
  D2.
- R1.5 ⇧1 encuadra todo el board, incluido el fixture de 1000 nodos.

Aceptación: con el fixture grande, ⇧1 deja los 1000 nodos dentro de la ventana; a 0.1 y a 2 el
trazo medido en pantalla está entre 1.5 y 2.5 px.

## R2 · Interacción. Obsidian salvo nota

- R2.1 Flechas mueven 20; ⇧ y flecha mueven 100.
- R2.2 Ajuste a objetos con guías al arrastrar y redimensionar. Se activa y desactiva desde el menú
  del fondo, igual que el ajuste a rejilla.
- R2.3 ⌃ desactiva el ajuste durante el arrastre.
- R2.4 ⇧ y arrastrar fija el eje.
- R2.5 ⌥ y arrastrar clona la selección y deja el original en su sitio.
- R2.6 Alinear y distribuir la selección.
- R2.7 Marco de la selección múltiple.
- R2.8 Pegar en la posición del ratón.
- R2.9 Menús con las opciones de Obsidian sin quitar las de DayliOS: nota de la bóveda, página
  web, ajustes de ajuste, solo lectura, convertir a archivo, seguir conexión.
- R2.10 Se mantienen ⌘D, conectar en vacío crea tarjeta, formas, adhesivas y minimapa. DayliOS.

Aceptación: prueba de interacción por cada punto sobre `interact.canvas`, con posiciones exactas
esperadas en el archivo guardado.

## R3 · Fidelidad visual. Obsidian

- R3.1 Tokens de la tabla visual de `comparison.md` para fondo, puntos, tarjeta, selección, color,
  conexión, grupo y controles.
- R3.2 Fondo de grupo con `background` y `backgroundStyle`.
- R3.3 Sin artefactos de esquina al seleccionar.

Aceptación: CSS computado igual a los valores de Obsidian en las propiedades medidas; captura
comparada contra la de Obsidian en la misma escena.

## R4 · Edición de texto

- R4.1 Obsidian. Doble clic edita dentro de la tarjeta sin cambiar zoom ni viewport.
- R4.2 Obsidian. Negrita y cursiva se guardan como markdown en `text`. Obsidian los ve igual.
- R4.3 DayliOS. Fuente, tamaño, alineación e interlineado por tarjeta en `daylios.style`. Obsidian
  ignora el campo y muestra el texto con su estilo por defecto.
- R4.4 DayliOS. Barra de formato visible solo al editar, con atajos ⌘B y ⌘I.
- R4.5 Escape sale guardando; el texto se guarda con el autoguardado del board.
- R4.6 Deshacer del board revierte el cambio de estilo.
- R4.7 `applyBoardOps` del MCP conserva `daylios.style` al editar texto.

Aceptación: abrir el `.canvas` en Obsidian tras editar no pierde texto ni nodos; parse y serialize
conservan `daylios.style`.

## R5 · Preview de documentos

- R5.1 Obsidian. Un nodo file de PDF muestra el documento dentro de la tarjeta con paginación.
- R5.2 DayliOS. Botón para abrirlo ampliado; al cerrar, el viewport y la selección siguen iguales.
- R5.3 Estados de carga, error y archivo no encontrado dentro de la tarjeta.
- R5.4 Archivos grandes: límite que se fija con el spike 0.5; por encima se muestra aviso y se abre
  solo ampliado.
- R5.5 El preview carga solo cuando la tarjeta está visible y por encima del umbral de R1.4.
- R5.6 Cargar un preview no detiene el pan ni el zoom: sin longtask de más de 50 ms atribuible.
- R5.7 Seguridad: solo archivos de la bóveda, leídos por IPC con `vault.safe`; sin scripts del
  documento; sin acceso a la API de la app; una web incrustada no puede pedir `vault://`.
- R5.8 Nota con `subpath` muestra la sección.
- R5.9 Obsidian. Un nodo link muestra la página en vivo dentro de la tarjeta, aislada de la app.
  Si el sitio no se deja incrustar, la tarjeta muestra host y URL como hoy.

## R6 · Rendimiento

- R6.1 Arnés reproducible en el repo con fixtures de 10, 200, 1000 y 5000 nodos.
- R6.2 Escenarios: abrir, encuadrar, pan y zoom alejado y al 100 %, arrastrar uno, arrastrar 100
  seleccionados, escribir en una tarjeta, guardar.
- R6.3 Ninguna fase sube el p95 de un escenario más de 16.7 ms sobre la línea base, D6.

## R7 · Robustez

- R7.1 Archivo dañado, nodo con archivo inexistente y conexión a nodo inexistente no rompen el board.
- R7.2 Campos desconocidos del `.canvas` se conservan al guardar.
- R7.3 Conflicto de versión igual que hoy.

## R8 · Accesibilidad

- R8.1 Botones de barra, menú y controles con nombre accesible.
- R8.2 Navegación por teclado entre nodos sin chocar con los atajos. Evaluar
  `disableKeyboardA11y`.
- R8.3 Foco visible en barra de formato y preview ampliado.

## Decisiones del usuario, 14 de octubre de 2026

- **D1** ⌥ y arrastrar clona, igual que Obsidian. ⌃ desactiva el ajuste durante el arrastre.
- **D2** Al alejar se mantienen las barras grises de DayliOS con `DETAIL_ZOOM` 0.45.
- **D3** Las páginas web se muestran dentro de la tarjeta con el comportamiento de Obsidian.
- **D4** Motor de PDF: el de mejor rendimiento y mejor UX. Resultado del spike 0.5: `pdfjs-dist`
  6.4.299 legacy, ver `spike-pdf.md`.
- **D5** `playwright-core` entra como devDependency con versión exacta.
- **D6** Tolerancia: el p95 no sube más de un frame, 16.7 ms, sobre la línea base del mismo
  escenario.
