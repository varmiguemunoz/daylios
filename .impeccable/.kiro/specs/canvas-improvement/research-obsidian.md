# Investigación · Obsidian Canvas

Equivale a `research/obsidian-canvas-analysis.md` del encargo. Vive junto a la spec, como
`automations/research-ghl.md`.

## Etiquetas

- **[O] Observado**: medido o visto en una instancia aislada de Obsidian. Evidencia en
  `.rea-evidence/obsidian/`.
- **[D] Documentado**: spec pública JSON Canvas 1.0 en jsoncanvas.org o la ayuda de Obsidian
  mostrada en su modal de atajos.
- **[H] Hipótesis**: inferencia sin verificar. No se usa como requisito sin validarla antes.

## 0. Método y límites

- REA `list_electron_targets` y `list_browser_targets` descartan las páginas `app://obsidian.md`
  como `unsupported_url`. REA no pudo inspeccionar el renderer de Obsidian.
- REA `inspect_electron_fuses` sobre Obsidian.app reportó Electron 43.7.7 y Chrome
  150.0.7871.250. RunAsNode, NodeOptions e Inspect desactivados.
- Alternativa usada: Obsidian lanzado con `--user-data-dir=/tmp/obs-rea` y
  `--remote-debugging-port=9333`, y Playwright `connectOverCDP` para DOM, CSS computado,
  interacciones y rendimiento.
- No se descompiló ni se extrajo código de Obsidian. Solo observación y fuentes públicas.
- La bóveda real del usuario no se tocó. Bóveda de prueba en `.rea-evidence/obsidian/vault`, tema
  oscuro, `nativeMenus: false` para poder leer los menús contextuales en el DOM.
- Ventana de 1024 por 800 en todas las mediciones.

Fixtures:

| archivo | contenido |
|---|---|
| `pequeno.canvas` | 10 tarjetas de texto, 1 grupo, nota, imagen, PDF de 2 páginas, enlace, 8 conexiones |
| `mediano.canvas` | 200 nodos, 200 conexiones |
| `grande.canvas` | 1000 nodos, 1000 conexiones |
| `interact.canvas` | 6 tarjetas de 260 por 140 en rejilla 3 por 2 y una conexión |

## 1. Modelo de datos

- [D] Nodo: `id`, `type` text, file, link o group, `x`, `y`, `width`, `height`, `color` opcional.
- [D] Por tipo: text `text`; file `file` y `subpath`; link `url`; group `label`, `background` y
  `backgroundStyle` cover, ratio o repeat.
- [D] Conexión: `id`, `fromNode`, `fromSide`, `fromEnd` por defecto none, `toNode`, `toSide`,
  `toEnd` por defecto arrow, `color`, `label`.
- [D] Color: preset "1" a "6" o hex. El orden del array es el orden z.
- [O] Seleccionar una tarjeta no reordena el array del archivo. Solo sube su z-index visual a 32.
- [O] Conectar arrastrando un punto de conexión guarda `fromSide` y `toSide`.
- [O] Etiqueta de conexión: Enter inserta saltos de línea. Se guardó como `"etiqueta\n\n"`.

## 2. Viewport, zoom y desplazamiento

- [O] Un solo contenedor `.canvas` con `transform: matrix(s,0,0,s,tx,ty)`.
- [O] Rango de zoom de 0.0625 a 2.
- [O] El zoom es animado, clase `mod-animating`.
- [O] Clase `mod-zoomed-out` en el wrapper al alejar. Umbral entre 0.209 y 0.33, no fijado. En fit
  el contenido markdown no se renderiza, 0 vistas en los tres fixtures, y se ve un icono gris.
- [O] Al 100 % solo están en el DOM los nodos visibles: 8 de 1000 en grande.
- [D] Desplazar con espacio y arrastrar o con la rueda. Horizontal con ⇧ y rueda. Zoom con ⌘ y
  rueda o espacio y rueda. ⇧1 encuadra todo, ⇧2 la selección.

## 3. Render

- [O] Nodos en DOM: `.canvas-node` con `translate(x,y)` y z-index. Dentro
  `.canvas-node-container`, `.canvas-node-content` y `.canvas-node-content-blocker`.
- [O] Contenido: `markdown-embed` para texto, `pdf-embed` con iframe para PDF,
  `media-embed image-embed` para imágenes. El enlace muestra la web en vivo.
- [O] Conexiones en `svg.canvas-edges` dentro del contenedor transformado. Cada una es un `<g>`
  con `path.canvas-interaction-path` y `path.canvas-display-path`.
- [O] Grosor constante en pantalla: el trazo mide unos 2 px en pantalla a cualquier zoom. A escala
  0.56 el trazo vale 3.57 en unidades del lienzo. Zona de clic de unos 24 px en pantalla.
- [O] Etiquetas de archivo y de conexión mantienen tamaño de pantalla con escala inversa.
- [O] Puntos de conexión de 15 px en pantalla, visibles al pasar el ratón.
- [O] Fondo `svg.canvas-background` con patrón de puntos.
- [H] Obsidian usa CodeMirror 6 como editor y PDF.js como visor. Coincide con lo visto, clases
  `markdown-embed` y barra de PDF, pero no se verificó el código.

## 4. Selección y manipulación

- [O] Clic selecciona. ⇧ y clic añade o quita. Arrastrar en el fondo dibuja un marco
  `.canvas-selection` con relleno de acento al 10 % y borde de 2 px de acento.
- [O] Con varios nodos aparece un marco `.mod-group-selection` de 3 px de acento al 30 %.
- [O] Flechas mueven 20 unidades. ⇧ y flecha mueven 100.
- [O] Ajuste a rejilla y a objetos. Un arrastre de 13 por 7 volvió a 400, 300.
- [O] ⌃ durante el arrastre desactiva el ajuste: quedó en 413, 307 exacto. [D] La ayuda dice que
  es Espacio, pero con Espacio siguió ajustando. Divergencia entre ayuda y comportamiento.
- [O] ⇧ y arrastrar fija el eje. ⌥ y arrastrar clona.
- [O] Redimensionar por los 4 bordes y las 4 esquinas, `.canvas-node-resizer`, cursores ew, ns y
  nwse.
- [O] Barra flotante `.canvas-menu`:
  - Una tarjeta: Borrar, Color, Zoom a selección, Editar.
  - Conexión: Borrar, Color, Zoom a selección, Editar.
  - Varios: Borrar, Color, Zoom a selección, Crear grupo, Alinear.
  - Grupo: además Editar etiqueta y Fondo.
- Límite: las opciones del submenú Alinear y el selector de color no se capturaron.

## 5. Tarjetas

- [O] Doble clic en el fondo crea una tarjeta de texto de 250 por 60 ya en edición.
- [O] Menú inferior `.canvas-card-menu` con 3 botones que se arrastran al lienzo: tarjeta, nota de
  la bóveda y medio de la bóveda.
- [O] Editar texto abre un `embed-iframe is-controlled` con vista previa markdown en vivo dentro de
  la tarjeta. La escala no cambia al editar.
- [O] Menú del nodo: Zoom a selección, Editar, Convertir a archivo, Borrar.

## 6. Conexiones

- [O] Se crean arrastrando un punto de conexión sobre otra tarjeta.
- [O] Doble clic en la conexión edita la etiqueta.
- [O] Menú de conexión: Editar etiqueta, Seguir conexión, Borrar.
- [O] Etiqueta de conexión de unos 15 px en pantalla, fondo igual al lienzo, relleno de unos 8 px y
  radio 4.

## 7. Atajos, menús y portapapeles

- [D] Modal de ayuda: ⌘A seleccionar todo. ⌘ y arrastrar crea una tarjeta del tamaño dibujado.
  Borrar con ⌫ o Supr. Deshacer ⌘Z. Rehacer ⌘Y o ⌘⇧Z.
- [O] ⌘C y ⌘V pegan cerca del ratón. ⌘D no hace nada. Deshacer y rehacer funcionan.
- [O] Menú del fondo: Añadir tarjeta, Añadir nota de la bóveda, Añadir medio de la bóveda,
  Añadir página web, Crear grupo, Pegar, Ajustar a rejilla, Ajustar a objetos, Solo lectura.
- [O] Menú con varios nodos: Zoom a selección, Crear grupo, Cortar, Copiar, Pegar, Borrar.

## 8. Persistencia

- [O] Guardado diferido: unos 2.0 s tras soltar un arrastre y unos 4.0 s tras escribir.

## 9. Estilos medidos, tema oscuro

| token | valor |
|---|---|
| fondo del lienzo | `#1C1C1C` |
| puntos | `#333333`, radio 0.7 |
| `--canvas-color` | `#7e7e7e` |
| etiqueta de tarjeta | `#666666` |
| acento | `hsl(258,88%,66%)`, rgb 138, 92, 245 |
| texto normal, tenue, débil | `#dadada`, `#b3b3b3`, `#666666` |
| fondo secundario, borde | `#282828`, `#333333` |
| color 1 y 6 | `#fb464c`, `#a882ff` |

Tema claro: fondo `#fff`, puntos `#e4e4e4`, `--canvas-color #c0c0c0`, colores 1 a 6 `#e93147`,
`#ec7500`, `#e0ac00`, `#08b94e`, `#00bfbc`, `#7852ee`.

Tarjeta:

- Borde de 1 px en `--canvas-color`, radio 8, fondo igual al lienzo.
- Sombra `rgba(0,0,0,.1) 0 .5px 1px .5px`.
- Texto con relleno 0 16 px, 16 px de fuente y 24 px de interlineado.
- Seleccionada: borde de 1 px de acento y sombra `0 0 0 2px` de acento.
- Con color: borde del color al 70 %, sombra interior de 1 px del color al 70 % y fondo teñido.

Grupo: etiqueta de unos 22.5 unidades, peso 400, `#b3b3b3`, fondo gris al 10 %, radio 4, relleno
4 por 8.

Controles: grupos con fondo `#333`, radio 4, borde de 1 px, botones de 32 por 32. Orden: ajustes;
acercar, restablecer, encuadrar, alejar; deshacer, rehacer; ayuda. Menú de tarjetas con fondo
`#282828`, radio 4, a 16 px del borde inferior.

## 10. Rendimiento medido [O]

Medidor por rAF: fps, p50, p95, peor frame y frames de más de 50 ms. Observer de longtask. pan son
60 eventos de rueda cada 16 ms, zoom 40 pasos de ⌘ y rueda, drag 60 movimientos.

| board | primer nodo ms | DOM en fit | escala fit | pan fit fps | zoom fit fps | DOM al 100 % | pan 100 | drag 100 |
|---|---|---|---|---|---|---|---|---|
| pequeño | 77 | 15 | 0.30 | 60 | 53.4, 5 frames de más de 50 ms | 8 | 60 | 60 |
| mediano | 38 | 200 | 0.126 | 60 | 58.8, 1 longtask de 74 ms | 12 | 60 | 60 |
| grande | 98 | 1000 | 0.0625 | 49.7, p95 49.9 | 34.1, p50 33.3 | 8 | 60 | 60 |

Una sola ejecución en Obsidian. La varianza no se midió.

## 11. Pendiente y no verificado

- Umbral exacto de `mod-zoomed-out` y qué oculta en cada tipo de nodo.
- Opciones de Alinear y Distribuir y su algoritmo.
- Valores de ajuste al redimensionar y tamaños mínimos.
- Comportamiento de `background` y `backgroundStyle` de grupo.
- Tema claro solo en tokens, sin capturas.
- Accesibilidad de Obsidian Canvas: no evaluada.
