# Diseño · Workspace estilo Obsidian

Brief según impeccable `shape`. Modo: **Operate** (el dueño trabaja dentro de su conocimiento).

## 1 · Brief

1. **Trabajo y persona.** El dueño entra varias veces al día a pensar, documentar y diagramar su
   negocio. Llega con una idea en la cabeza y quiere escribirla o dibujarla sin ver nada más.
2. **Resultado.** Del atajo al cursor escribiendo en menos de un segundo. El canvas se siente igual
   de ligero que Obsidian con cientos de tarjetas.
3. **Dirección.** La autoridad visual es Obsidian por defecto en oscuro, no DESIGN.md: grises
   neutros, tipografía del sistema, acento violeta y la paleta de colores de canvas de Obsidian.
   Tesis de interacción: el lienzo es el protagonista y la interfaz aparece solo cuando hace falta,
   al pasar el ratón o al seleccionar.
4. **Alcance.** Solo el workspace: shell, explorador, notas, canvas y atajo. El resto de Consultora
   y el menubar no cambian.
5. **Estados.** Bóveda vacía, carpeta vacía, sin archivo abierto, board vacío, archivo borrado fuera,
   imagen rota, conflicto de versión y grabación en curso.
6. **Antiobjetivos.** Nada de sombras grandes, píldoras pastel ni radios de 20 px dentro del
   workspace. Ninguna barra visible que no esté haciendo algo.

## 2 · Tema Obsidian

Un ámbito de CSS propio: `.theme-obsidian` en la raíz del workspace. Los tokens de la app no se
tocan; dentro del ámbito se redefinen:

| Token           | Valor                                                                                 | Uso                                     |
| --------------- | ------------------------------------------------------------------------------------- | --------------------------------------- |
| `--ob-bg`       | `#1e1e1e`                                                                             | Panel principal y lienzo                |
| `--ob-bg-alt`   | `#262626`                                                                             | Cinta, explorador, franja superior      |
| `--ob-bg-hover` | `#2f2f2f`                                                                             | Filas al pasar el ratón                 |
| `--ob-border`   | `#363636`                                                                             | Separadores, borde de tarjeta sin color |
| `--ob-text`     | `#dadada`                                                                             | Texto                                   |
| `--ob-muted`    | `#999999`                                                                             | Texto secundario, iconos                |
| `--ob-faint`    | `#666666`                                                                             | Puntos del fondo, conexiones            |
| `--ob-accent`   | `#8a5cf5`                                                                             | Selección, foco, archivo activo         |
| `--ob-radius`   | `8px` tarjetas, `4px` filas                                                           |                                         |
| `--ob-font`     | `-apple-system, BlinkMacSystemFont, "Inter", sans-serif`, 13 px interfaz, 16 px notas |

Colores de canvas, los de Obsidian: «1» `#fb464c`, «2» `#e9973f`, «3» `#e0de71`, «4» `#44cf6e`,
«5» `#53dfdd`, «6» `#a882ff`. Tarjeta con color: borde 2 px del color y fondo `color-mix` del color
al 8 % sobre `--ob-bg`. Iconos: Lucide, los mismos que usa Obsidian.

## 3 · Shell sin cromo

`ConsultoraApp` decide el cromo por pantalla: las de workspace usan `chrome: 'none'`, sin barra
lateral ni cabecera. Organismo nuevo `workspace/organisms/ObsidianShell.tsx`:

```
┌ franja 38 px · arrastrable · [● ● ●]      nombre del archivo        ● REC ┐
│ cinta │ explorador 260 px (redimensionable) │ panel principal            │
│ 44 px │ árbol de carpetas y archivos        │ nota · board · imagen ·    │
│       │                                     │ vista de carpeta · vacío   │
└───────┴─────────────────────────────────────┴────────────────────────────┘
```

- Cinta: `Compass` abre la navegación de Consultora como panel flotante sobre la cinta, `PanelLeft`
  muestra u oculta el explorador, `Search` abre el buscador, `FilePlus` y `Shapes` crean nota y
  board. Abajo, `Settings` lleva a Ajustes.
- El ancho del explorador se arrastra y se recuerda. ⌘\ lo oculta.
- `ConsultoraNavPanel`: la misma lista de secciones de la barra lateral, en un Drawer izquierdo.
- La franja usa `-webkit-app-region: drag` con un hueco de 78 px para los botones de macOS.

## 4 · Explorador

`FileExplorer.tsx` reemplaza a `FolderTree`. Lee un árbol completo con archivos:
`WorkspaceApi.tree()` gana `files: WorkspaceItem[]` por carpeta, más los de la raíz. Filas de 26 px,
13 px, sangría de 16 px por nivel, guías verticales finas como Obsidian, sin iconos en los archivos
salvo boards e imágenes. Estado plegado y archivo abierto recordados.

Navegación nueva: el stack de Consultora se mantiene, pero dentro del workspace abrir un archivo
reemplaza la pantalla actual en vez de apilar, como un panel de Obsidian. Atrás vuelve al archivo
anterior.

`QuickSwitcher.tsx`: modal arriba al centro, lista con coincidencias resaltadas, flechas y Enter.
Si no hay resultado, «Crear nota "…"» en la carpeta abierta.

## 5 · Notas y nombres

`NoteService.settle(id)` aplica a todas las notas: `fileNameFor(body)` = título limpio, sin fecha.
Se llama al salir y en `onCommit` del editor. `WorkspaceService.rename` sobre una nota reescribe
también la primera línea con `setNoteTitle(body, name)`: si la primera línea es `# x` pasa a
`# nombre`, si no, inserta `# nombre`.

Vista de nota en el workspace: `NoteEditor` con `variant="document"`: título grande sin botón Atrás,
columna de 700 px centrada y relaciones al final con estilo de backlinks.

## 6 · Atajo global

`main/workspace-shortcut.ts` con `globalShortcut`. Ajuste `workspaceShortcut`, por defecto
`Alt+CommandOrControl+W`. Al pulsar: si Consultora está enfocada y en el workspace, la oculta; si no,
`showConsultora()` y envía `consultora:navigate` con `{ workspace: true }`. `onConsultoraNavigate`
acepta ese destino. Ajustes muestra el atajo, permite cambiarlo y avisa si no se pudo registrar.

## 7 · Canvas

Se mantiene React Flow como motor y se apaga todo su aspecto: sin `style.css` completo, solo
`base.css`, que trae lo mínimo para funcionar. Todo lo visible se pinta con el tema.

**Componentes nuevos o reescritos** en `workspace/board/`:

- `CanvasCard.tsx`: un solo componente para texto, nota adhesiva y forma, con `React.memo` y
  comparación por `data` y `selected`.
- `EdgeHandles.tsx`: cuatro puntos fuera del borde, visibles con hover.
- `ResizeEdges.tsx`: `NodeResizer` con líneas invisibles de 8 px de grosor y sin tiradores.
- `CanvasControls.tsx`: columna arriba a la derecha.
- `CardToolbar.tsx`: barra abajo al centro con arrastrar para soltar.
- `SelectionMenu.tsx`: sobre la selección, con `NodeToolbar` de React Flow.
- `GroupNode.tsx`: rótulo y tinte; borrar pregunta en un Modal.
- `ObsidianEdge.tsx`: bezier de 2 px en `--ob-faint`, flecha rellena y etiqueta con fondo.

**Grupos.** Puros y probados en `shared/canvas-groups.ts`:

```ts
contains(group, node): boolean                // node cabe entero en el grupo
childrenOf(group, nodes): CanvasNode[]        // incluye grupos anidados y lo de dentro
groupAround(nodes, padding = 40): Rect        // rectángulo para «Crear grupo»
```

Al empezar a arrastrar un grupo se calcula `childrenOf` una vez. Durante el arrastre se mueven
juntos aplicando el mismo desplazamiento en `onNodesChange`. No se usa `parentId` de React Flow: el
formato sigue plano, como JSON Canvas.

**Rendimiento.**

- Guardar sin JSON por fotograma: `BoardCanvas` marca sucio y expone `snapshot()` por ref; el
  autoguardado lo pide medio segundo después del último cambio.
- Nivel de detalle: un selector de zoom con `useStore` de React Flow, con umbral 0.45. Por debajo,
  `CanvasCard` pinta barras grises en vez de markdown, como en Obsidian. Las imágenes se mantienen.
- `onlyRenderVisibleElements`, `nodeTypes` y `edgeTypes` constantes, callbacks estables, nada de
  sombras ni `backdrop-filter` en tarjetas.
- Markdown de cada tarjeta memorizado por texto.
- Medición: un board de prueba de 500 tarjetas generado en un test de `canvas-groups`, y una
  pasada de impeccable `optimize` con el perfilador de React.

## 8 · Archivos

Nuevos: `ObsidianShell`, `Ribbon`, `ConsultoraNavPanel`, `FileExplorer`, `QuickSwitcher`,
`EmptyWorkspace`, `CanvasCard`, `EdgeHandles`, `ResizeEdges`, `CanvasControls`, `CardToolbar`,
`SelectionMenu`, `ObsidianEdge`, `shared/canvas-groups.ts` con pruebas, `main/workspace-shortcut.ts`,
`theme-obsidian` en `main.css`.

Cambian: `ConsultoraApp`, `lib.ts` de Consultora, `WorkspaceLayout` se retira, `Workspace`,
`WorkspaceNote`, `WorkspaceBoard`, `WorkspaceImage`, `BoardCanvas`, `flow.ts`, `NoteEditor`,
`NoteService`, `WorkspaceService.rename`, `shared/workspace.ts`, `config.ts`, `Settings`, preload.

Se retiran: `BoardToolbar`, `SelectionBar`, `TextNodes`, `FolderTree`, `WorkspaceLayout`.

## 9 · Limitaciones

- ⌥⌘W en macOS es «Cerrar todas las ventanas» en Finder, Chrome y otras apps. Un atajo global se lo
  quita a todas mientras DayliOS esté abierto. Por eso es configurable.
- React Flow pinta con DOM. Con unos cientos de tarjetas va fluido; con miles se nota, igual que en
  Obsidian. El nivel de detalle lo compensa.
- No puedo abrir la app ni ver pantallas. La pasada visual de impeccable se hace con tus capturas.
- Copio aspecto y comportamiento de Obsidian, no su código, que es cerrado.
