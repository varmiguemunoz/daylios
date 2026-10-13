# Diseño · Detalle de tarea minimalista

Solo renderer. Atomic design con los primitivos de `src/renderer/src/ui`.

## 1 · Editor sin modos

`components/MarkdownEditor.tsx` se reescribe con la misma interfaz pública más dos props:

```ts
interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  status: SaveStatus
  placeholder: string
  emptyHint: string            // ahora: «Doble clic para escribir…»
  /** Guarda ya. Lo llama al salir de edición. */
  onCommit?: () => Promise<void>
  /** Empezar editando: nota nueva y vacía. */
  autoEdit?: boolean
}

/** Las pantallas ignoran el Esc que viene del campo en edición. */
export const fromMarkdownEditor: (e: KeyboardEvent) => boolean
```

Estado interno: `editing: boolean`, `caret: number`. Constante `IDLE_MS = 2000`.

- Lectura: `div` enfocable con `role="textbox"` y `aria-readonly`, `onDoubleClick` entra.
  Con texto vacío, `onClick` entra.
- Edición: `textarea` con `autoFocus`; al montar restaura `caret`.
- Temporizador: cada `onChange` reinicia un `setTimeout(IDLE_MS)`. Al vencer, o en `onBlur`, o con Esc:
  guarda `selectionStart` en `caret`, pasa a lectura y llama `onCommit`.
- Esc en edición: captura con `stopPropagation`, así la pantalla no vuelve atrás.
- ⌘E entra si está en lectura. En edición no hace nada.
- `SaveLabel`: solo `saving` y `error`. Va pequeño a la derecha, encima del texto, sin ocupar fila
  cuando no hay nada que decir.

Hook nuevo `lib/useIdleExit.ts` con el temporizador, para que el componente quede legible:

```ts
function useIdleExit(active: boolean, ms: number, onIdle: () => void): { poke: () => void }
```

Los tres usos pasan `onCommit={flush}`: `TaskDetail`, `NoteEditor` y `consultora/screens/Document`.

## 2 · Cabecera mínima del detalle

`TaskDetail.tsx` queda así:

```
[← Hoy]                                   [Detalles] [Borrar]
○  Documento: Modelo de referidos para clientes
   Hoy · 13 de octubre · de ayer
   ▮▮▮  #ventas  ☑ 0/3                   ← TaskSummary, clic abre panel
   Descripción en lectura…
```

Molécula nueva `components/TaskSummary.tsx`: reutiliza `EffortBars`, `TagChips` y
`SubtaskProgress`. Es un botón. Props: `task: Task`, `onOpen()`.
Sin datos muestra el texto de R2.2 en `text-milk-soft`.

`TaskDetail` pierde `TaskTagsEffort` y `SubtaskList` del cuerpo. La lógica de subtareas que hoy
vive en `TaskDetail` se mueve a un hook `lib/useSubtasks.ts`, que también usa la lista de Hoy:

```ts
function useSubtasks(parentId: string | null, revision: number): {
  subtasks: Task[]
  add(title: string): Promise<boolean>
  toggle(sub: Task): void
  reorder(id: string, index: number): void
  completeAll(): void
  drop(sub: Task): void        // quita en local; el borrado con Deshacer lo hace useDay
  error: string | null
}
```

Con `parentId` null no carga nada, para el caso de una subtarea.

## 3 · Panel lateral

Organismo nuevo `components/TaskDetailsDrawer.tsx`:

```ts
interface TaskDetailsDrawerProps {
  open: boolean
  onClose: () => void
  task: Task
  onUpdate: (patch: TaskPatch) => void
  /** Ausente en subtareas: el panel no muestra la sección. */
  subtasks?: ReturnType<typeof useSubtasks>
  onOpenSubtask: (sub: Task) => void
  onRemoveSubtask: (sub: Task) => void
}
```

- Usa `ui/organisms/Drawer`. El ancho ya es `min(360px, 100vw − 48px)`, en el menubar queda 352px.
- Secciones con el `Group` de etiqueta micro de Consultora. `TaskTagsEffort` se parte en dos
  moléculas, `EffortPicker` y `TaskTagEditor`, para poder ordenarlas y titularlas por separado.
- `SubtaskList` se usa tal cual dentro del panel.
- Mientras el panel está abierto, Esc lo cierra a él y no a la pantalla. Ya lo resuelve la pila de
  `overlay.ts` y el `isOverlayOpen()` que `TaskDetail` debe consultar en su Esc.

## 4 · Subtareas en Hoy

`TaskRow` gana dos props opcionales:

```ts
expanded?: boolean
onExpand?: (open: boolean) => void   // presente = la fila tiene subtareas
```

- `SubtaskProgress` acepta `onClick` y `expanded`. Con `onClick` se dibuja como botón con
  `ChevronRight` que rota 90° al abrir, `aria-expanded`, y `stopPropagation` para no abrir el detalle.
- Teclado en `onRowKey`: `ArrowRight` despliega, o entra a la primera subtarea si ya está abierta.
  `ArrowLeft` pliega. En una subtarea, `ArrowLeft` enfoca `[data-row=<parentId>]`.

Organismo nuevo `components/SubtaskDropdown.tsx`: se monta debajo de la fila madre dentro de su
propio `<li>`, para que el índice de arrastre de las madres no cambie.

```ts
interface SubtaskDropdownProps {
  parent: Task
  revision: number
  onOpen: (sub: Task) => void
  onRemove: (sub: Task) => void
  onChanged: () => void        // recarga el día: actualiza el 2/5
}
```

- Usa `useSubtasks(parent.id, revision)` y su propio `useReorder` con grupo `sub:<id>`.
  Dos instancias de `useReorder` no se pisan: cada una ignora el soltar si no arrastró ella.
- Filas `TaskRow size="compact"` con `pl-[38px]`, alineadas al texto de la madre.
- Entrada con la misma `row-in` que ya existe.

`TodayView`: estado `expanded: Set<string>` guardado en `localStorage` bajo
`today.expanded`, con try y catch. Se limpia de ids que ya no están en el día.

`useDay`: nuevo `patchProgress(parentId, subtasks)` que recalcula el `2/5` sin recargar el día;
`revision` ya existe para que los desplegables recarguen tras deshacer.

`App`: una subtarea abierta desde Hoy lleva `fromList`, así Atrás vuelve a Hoy y no a la madre.

## 5 · Archivos

Nuevos: `lib/useIdleExit.ts`, `lib/useSubtasks.ts`, `components/TaskSummary.tsx`,
`components/TaskDetailsDrawer.tsx`, `components/SubtaskDropdown.tsx`, `components/EffortPicker.tsx`,
`components/TaskTagEditor.tsx`.

Cambian: `MarkdownEditor`, `TaskDetail`, `TaskRow`, `SubtaskProgress`, `TodayView`, `useDay`,
`NoteEditor`, `consultora/screens/Document`, `DESIGN.md`.

Se borra: `TaskTagsEffort.tsx`, reemplazado por las dos moléculas.

## Riesgos

- Salir a los 2 segundos mientras piensas. Mitigación: el cursor vuelve a su sitio con ⌘E o doble
  clic. `IDLE_MS` es una constante por si 2 segundos resulta corto.
- Doble clic sobre una palabra la selecciona antes de entrar. Se limpia la selección al entrar.
