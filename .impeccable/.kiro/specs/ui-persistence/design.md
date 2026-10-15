# Diseño · A1 Persistencia de la interfaz

## 1 · Almacén de estado

`ui-state.json` en la carpeta de datos de la app, como el `workspace.json` de Obsidian.

- **Main:** `services/ui-state.ts`, clase `UiStateStore`: carga al arrancar, valida la versión,
  escritura atómica a un temporal y `rename`, espera de 500 ms entre cambios y guardado forzado al
  salir. Pruebas con archivo dañado, versión distinta y recorte.
- **Forma:** `{ version: 1, values: Record<string, unknown> }` con claves por espacio de nombres:
  `menubar.screen`, `menubar.scroll.today`, `history.period`, `capture.draft`,
  `menubar.window`, `consultora.nav`, `consultora.window`, `contacts.filters`,
  `scroll.client:<id>`, `board.viewport:<id>`.
- **Límites:** 2 MB; como mucho 500 claves `scroll.*` y `board.viewport:*`, se descartan las más
  antiguas.
- **IPC:** `ui:load` devuelve todo una vez, `ui:patch` recibe `{ key: value | null }`. Preload
  expone `window.api.ui`. Las dos ventanas comparten el almacén; cada una escribe solo sus claves.
- **Arranque sin parpadeo:** `main.tsx` espera `ui:load` antes de pintar. El renderer guarda una
  caché y las lecturas son síncronas.

## 2 · Hooks del renderer

`src/renderer/src/lib/ui-state.ts`:

- `uiState.get(key, fallback)` y `uiState.set(key, value)` con espera.
- `useUiState<T>(key, fallback, valid?)`: como `useState`, guardado en el almacén; si el valor no
  pasa `valid`, usa el de por defecto.
- `useScrollMemory(ref, key, ready)`: restaura el scroll cuando `ready` es verdadero, ya con el
  contenido pintado, y lo guarda al desplazarse con espera.
- El `prefs` del workspace pasa a ser una capa sobre el almacén; el código existente no cambia.

## 3 · Menubar

- **Pestañas montadas:** `App` monta las tres vistas a la vez y oculta las inactivas con `hidden`.
  Así conservan estado, scroll y campos sin guardar nada. Los detalles se pintan encima de la lista
  en vez de reemplazarla, así volver no reinicia el scroll.
- **Pantalla:** se guarda `menubar.screen` como `{ name, id }`, sin el objeto completo. Al
  restaurar, `task` y `note` se cargan por id; si fallan, se abre su pestaña.
- **Estado de vistas:** `HistoryView` guarda periodo, rango y página con `useUiState`; `NotesView`
  su página; `TodayView` el borrador de captura y las madres desplegadas.
- **Scroll:** `useScrollMemory` en los tres `main` con claves por pestaña.
- **Fijar:** botón de chincheta en la cabecera de cada pestaña. Main gana `menubar:pin` por IPC:
  - fijada: sin ocultar en `blur`, `movable` y redimensionable en alto entre 480 y 1000 px, y se
    guarda `menubar.window` con posición y alto al moverla;
  - desfijada: vuelve a `placeUnder` y al comportamiento de popover.
  - Al arrancar, main lee el estado de fijada del almacén antes de crear la ventana.

## 4 · Consultora

- `ConsultoraApp` guarda `{ stack, future, sections }` en `consultora.nav`. Al restaurar descarta
  pantallas que no encajan con el tipo `Screen`. Las fichas que responden «no existe» llaman a
  `chrome.replaceWithRoot()`.
- `consultora-window.ts` guarda `bounds`, `displayId`, `maximized` y `fullscreen`; al crear la
  ventana comprueba con `screen.getAllDisplays()` que cabe en alguna pantalla.
- Listas: `useUiState` para filtros, búsqueda, página, vista y orden. `Page` usa
  `useScrollMemory` con la clave de la pantalla.
- Workspace: viewport por board en `BoardCanvas` con `onMoveEnd`; scroll por nota en `NotePane`.

## 5 · Migración

Al primer arranque con el almacén vacío se copian de `localStorage` las claves `shell.sidebar.*`,
`ws.*`, `settings.tab`, `today.expanded`, `pipeline.*` y `props.collapsed.*`, y se marca
`migrated.localStorage`.

## 6 · Riesgos

- Montar las tres pestañas a la vez carga Historial y Notas al abrir. Se cargan perezosamente la
  primera vez que se muestran y luego se quedan montadas.
- Restaurar el scroll antes de que llegue el contenido: se espera a la carga y se reintenta en el
  siguiente fotograma.
