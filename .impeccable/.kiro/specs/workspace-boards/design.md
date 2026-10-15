# Diseño · W3 Boards

## Dependencia

`@xyflow/react` v12, versión exacta fijada en `package.json`. Se usa: `ReactFlow`, `Background`,
`Controls`, `MiniMap`, `NodeResizer`, `Handle`, edges con `MarkerType`. Su CSS base se importa una
vez y se sobreescribe con los tokens de `main.css`.

## Formato

`src/shared/canvas.ts`, puro y probado:

```ts
interface CanvasFile {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}
// JSON Canvas 1.0: text, file, link, group. Campos extra que Obsidian ignora:
// daylios: { kind: 'sticky' | 'text' | 'shape'; shape?: 'rect' | 'ellipse' | 'diamond' }
function parseCanvas(json: string): CanvasFile // tolera archivos de Obsidian
function serializeCanvas(c: CanvasFile): string // orden estable, sin ruido en diffs
function toFlow(c: CanvasFile): { nodes: Node[]; edges: Edge[] }
function fromFlow(nodes: Node[], edges: Edge[]): CanvasFile
```

Colores: JSON Canvas usa `"1"` a `"6"`; se mapean a apricot, butter, mint, coral, rose y milk.

Los nodos `file` guardan la ruta relativa a la bóveda. `workspace_refs` registra cada imagen y
nota incrustada, así renombrar o mover actualiza el board.

## Backend

Sin servicio nuevo: `WorkspaceService.readBoard(id)` y `writeBoard(id, json, expectedMtime)`
validan con `parseCanvas` antes de escribir y recalculan referencias.

## UI

`consultora/workspace/board/`:

- `BoardScreen.tsx`: carga, conflicto, autoguardado con `useAutosave` (500 ms, el mismo de notas).
- `BoardCanvas.tsx`: `ReactFlow` controlado, historial propio para ⌘Z, atajos.
- `BoardToolbar.tsx`: flotante abajo al centro: seleccionar, nota, texto, forma, imagen, nota de la
  bóveda, grupo; zoom y ajustar.
- `nodes/StickyNode`, `TextNode`, `ShapeNode`, `ImageNode`, `NoteNode`, `GroupNode`: un componente
  por tipo, todos con `NodeResizer` y edición con doble clic sobre `Markdown`.
- `EdgeInspector.tsx`: al seleccionar una conexión, mini barra con flecha, sin flecha, ambas,
  etiqueta y borrar.

## Pruebas

`canvas.test.ts`: ida y vuelta sin pérdida, archivo de Obsidian real, campos desconocidos se
conservan, rutas de archivo reescritas al mover.
