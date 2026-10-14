# Diseño · Consultora estilo Obsidian

Brief según impeccable `shape`. Modo: **Operate**. El dueño trabaja en su negocio todo el día:
clientes, reuniones, pipeline y correo.

## 1 · Brief

1. **Trabajo y persona.** El dueño salta entre su bóveda, un cliente, una reunión y el pipeline
   varias veces por hora. Quiere que todo se sienta como una sola herramienta.
2. **Resultado.** Cambiar de sección no cambia el marco. Ningún salto visual entre el workspace y
   el resto.
3. **Dirección.** La autoridad visual es Obsidian oscuro, la misma del workspace: grises neutros,
   fuente del sistema, acento violeta y la paleta de colores de Obsidian. Tesis: el contenido manda
   y el marco no se mueve.
4. **Alcance.** Toda la ventana de Consultora. El menubar no cambia.
5. **Estados.** Lista vacía, cargando, error, conflicto, grabando, barra lateral oculta, ventana
   estrecha y diálogos abiertos.
6. **Antiobjetivos.** Píldoras grandes, títulos en extra negrita, sombras de tarjeta, rellenos
   pastel y radios de 20 px. Ningún adorno que no sea de Obsidian.

## 2 · Tokens

El tema ya redefine colores, tamaños de texto y radios bajo `body.theme-obsidian`. Faltan las
formas que hoy están escritas a mano en las clases. Se añaden tokens semánticos en `@theme` con el
valor actual del menubar, y el tema los redefine:

| Token                     | Menubar              | Obsidian                         | Utilidad          |
| ------------------------- | -------------------- | -------------------------------- | ----------------- |
| `--radius-control`        | 9999px               | 4px                              | `rounded-control` |
| `--radius-card`           | el actual de tarjeta | 8px                              | `rounded-card`    |
| `--spacing-control`       | 2.5rem               | 30px                             | `h-control`       |
| `--shadow-float`          | la sombra actual     | 0 6px 20px -8px rgb(0 0 0 / 0.6) | `shadow-float`    |
| `--font-weight-extrabold` | 800                  | 600                              | `font-extrabold`  |
| `--font-weight-bold`      | 700                  | 600                              | `font-bold`       |

Tailwind 4 genera las utilidades leyendo estas variables, así que redefinirlas en el ámbito del tema
basta. Regla: el código compartido con el menubar usa tokens de la app y estos tokens semánticos; el
código que solo vive en Consultora usa los tokens `ob-*` directamente, para que se lea como
Obsidian.

Colores de estado, como tinte al 15 % con texto del color: rojo `#fb464c`, naranja `#e9973f`,
amarillo `#e0de71`, verde `#44cf6e`, cian `#53dfdd`, violeta `#a882ff`.

## 3 · Marco único

`ObsidianShell` sale del workspace y pasa a `consultora/shell/AppShell.tsx`. `ConsultoraApp` lo
usa para todas las pantallas. Desaparecen la barra lateral vieja, la cabecera con buscador y
`ConsultoraNavPanel`.

```
┌ franja 38 px · [● ● ●]  ‹ ›   Clientes › Acme                    ● REC  … ┐
│ cinta │ [Secciones][Archivos] │                                          │
│  44   │ Consultora            │                                          │
│  ▦    │  ▸ Workspace          │            panel principal               │
│  ▤    │  ▸ Clientes  ■        │                                          │
│  ⌕    │  ▸ Contactos          │                                          │
│  ＋   │ Email                 │                                          │
│  ◇    │  ▸ Fuentes …          │                                          │
│  ⚙    │  180 a 480 px  ┆      │                                          │
└───────┴───────────────────────┴──────────────────────────────────────────┘
```

- **Franja:** atrás y adelante con el historial de pantallas, ruta en el centro, `Recorder` a la
  derecha. El grabador queda montado siempre en el marco, así nunca se corta.
- **Cinta:** Secciones y Archivos eligen la pestaña de la barra lateral; pulsar la activa oculta la
  barra. Buscar abre ⌘K. Nueva nota y Nuevo board crean en la bóveda y abren el workspace.
- **Barra lateral:** `SidebarTabs` con dos vistas. `SectionNav` con filas de 30 px y grupos
  «Consultora» y «Email». `FileExplorer`, el mismo del workspace, montado en el marco para que no se
  recargue al cambiar de sección. Pestaña recordada en `shell.sidebar.tab.<contexto>`, ancho en
  `shell.sidebar.width`, visible en `shell.sidebar.visible`.
- **Contexto del marco:** `ChromeContext` crece con `setTitle`, `setMore` y `sidebar`. Cada
  pantalla declara su ruta y su menú «…». `WorkspaceApp` deja de tener marco propio y queda solo
  como contenido; su `WorkspaceContext` se monta en el marco porque el explorador lo necesita.
- **Atajos del marco:** ⌘K, ⌘O, ⌘[, ⌘], ⌘\ y ⌘,. Se ignoran cuando hay un diálogo abierto o se
  escribe en un campo, salvo ⌘K y ⌘O.

## 4 · Buscador global

`GlobalSwitcher` reutiliza el aspecto del `QuickSwitcher` del workspace: caja centrada arriba de
600 px, campo de 40 px y resultados de 32 px agrupados por tipo con su icono. Usa la misma búsqueda
que hoy alimenta la pantalla de resultados. Flechas para moverse, Enter abre, ⌘Enter va a «Ver
todos». La pantalla de resultados se conserva con estilo de tabla.

## 5 · Piezas

| Pieza                 | Obsidian                                                                         |
| --------------------- | -------------------------------------------------------------------------------- |
| `Button` principal    | acento sólido, texto blanco, 30 px, radio 4, peso 500                            |
| `Button` normal       | fondo `#363636`, al pasar `#3f3f3f`                                              |
| `Button` peligro      | texto rojo, tinte rojo al pasar                                                  |
| `IconButton`          | 28 px, radio 4, icono gris, al pasar fondo `ob-hover`                            |
| Campos y `Select`     | fondo `ob-bg`, borde 1 px `ob-border`, radio 4, 30 px, foco con borde acento     |
| `Pill`, estados, tags | etiqueta de Obsidian: 20 px, texto 12, tinte del color al 15 %                   |
| `List` y `Row`        | filas de tabla de 32 px, separador 1 px, sin tarjeta                             |
| `Section`             | encabezado 16 px peso 600 con línea fina debajo                                  |
| `Page`                | sin cabecera grande: la ruta vive en la franja; título y acciones en una fila    |
| `Empty`, `ErrorNote`  | texto tenue centrado; error en rojo con tinte                                    |
| `Modal`               | fondo `ob-alt`, borde 1 px, radio 8, título 16 peso 600, velo negro al 50 %      |
| `Drawer`              | como la barra lateral derecha de Obsidian: `ob-alt`, borde izquierdo, sin sombra |
| `ContextMenu`         | `ob-alt`, borde, radio 6, filas de 28 px, texto 13                               |
| `SegmentedToggle`     | grupo de botones de 26 px con el activo en `ob-active`                           |
| `SearchField`         | campo de Obsidian con lupa                                                       |
| `Kbd`                 | tecla de Obsidian: fondo `ob-active`, texto 11                                   |

Piezas nuevas en `consultora/molecules`:

- `Properties`: bloque de propiedades de nota de Obsidian. Filas de 30 px con icono, nombre de
  140 px en gris y valor editable con `InlineField`. Encabezado «Propiedades» plegable.
- `Table`: cabecera de 28 px en texto 12 gris y filas de 32 px. Columnas declaradas por props, con
  columnas que se ocultan en anchos estrechos.

`Page` gana `variant: 'table' | 'document' | 'board'`. Table ocupa el ancho con márgenes de 24 px.
Document es la columna centrada de 760 px con título en línea de 28 px peso 700. Board ocupa todo
el panel, para el pipeline.

## 6 · Pantallas

- **Clientes, Contactos, Reuniones, Tags, Fuentes, Reglas, Secuencias, Newsletters:** `Page`
  table con `Table`. Filtros como fila de botones pequeños encima de la tabla.
- **Cliente, Contacto, Prospecto, Proyecto, Reunión:** `Page` document. Título en línea, después
  `Properties` con los campos que hoy están en la cabecera y en las rejillas, y luego las secciones
  como encabezados. Las notas relacionadas al final, como los enlaces entrantes de Obsidian.
- **Documento y Nota:** el `NoteEditor` en variante document, como en el workspace.
- **Pipeline:** columnas `ob-alt` de 280 px con radio 8 y título 13 peso 600 con contador.
  Tarjetas `ob-bg` con borde 1 px y radio 6, sin sombra; al arrastrar, borde acento. La tabla y el
  editor de etapas pasan a `Table` y a filas de ajustes.
- **Reuniones y grabación:** `MeetingSheet` como modal de Obsidian. `Recorder` en la franja: en
  reposo un icono de grabar, grabando un punto rojo con tiempo.
- **Ajustes:** `SettingsHub` pasa a lista vertical de categorías de 200 px. Cada ajuste es una fila
  con nombre de 15 px, descripción de 13 px gris y control a la derecha, separadas por 1 px.

## 7 · Componentes compartidos con el menubar

`ui/` y `components/` se usan en las dos ventanas. Solo cambian sus clases a tokens semánticos:
`rounded-full` pasa a `rounded-control`, alturas a `h-control`, sombras a `shadow-float`. Con los
valores por defecto el menubar no cambia. Los puntos de estado y los avatares redondos se quedan
con `rounded-full`, porque en Obsidian también son redondos.

## 8 · Cambios al implementar

- La cinta no tiene Secciones y Archivos: esas son las pestañas de la barra lateral, como en
  Obsidian. La cinta queda con barra lateral, buscar, nueva nota, nuevo board y Ajustes.
- Las piezas compartidas con el menubar no usan tokens de radio y altura: llevan clases `ui-*` sin
  estilo fuera del tema, y el tema les da la forma de Obsidian con reglas fuera de capa. Así el
  menubar queda idéntico sin tocar sus clases. Solo se añadieron los tokens `--shadow-float`,
  `--color-ob-link` y los pesos 600 bajo el tema.
- `Page` perdió el botón Atrás: vive en la franja.

## 9 · Riesgos y límites

- Son unas 7 500 líneas de interfaz. Se hace por fases y cada fase deja la ventana usable.
- Si Tailwind no regenera alguna utilidad con la variable redefinida, se añade una regla en el
  ámbito del tema para esa utilidad. Se revisa en la fase 4.
- Sin capturas no puedo ver el resultado. La pasada de pulido necesita capturas de cada sección.
- No incluye tema claro ni paleta de comandos tipo ⌘P de Obsidian.
