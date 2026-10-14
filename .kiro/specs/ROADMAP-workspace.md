# Roadmap · Workspace interno

Workspace de conocimiento al estilo Obsidian para organizar y Miro para diagramar, dentro de la
ventana de Consultora. Plan aprobado por el dueño el 13 oct 2026.

## Decisiones del dueño

1. **Bóveda en disco.** Una carpeta real con `.md`, imágenes y boards. Se ve en Finder y Claude la
   puede leer. SQLite solo guarda un índice con ids estables, títulos, fechas y referencias.
2. **Notas unificadas.** Las notas del menubar pasan a la bóveda, en `Notas rápidas/`. Un solo
   sistema de notas. Relaciones, notas de voz y herramientas MCP siguen funcionando.
3. **Solo el dueño y Claude.** App local, sin cuentas ni sync. Los permisos significan que nada
   sale de la bóveda: rutas confinadas, sin symlinks hacia fuera, protocolo propio para imágenes.
4. **Boards con `@xyflow/react`.** Una sola dependencia nueva. Formato de archivo JSON Canvas
   `.canvas`, el estándar abierto de Obsidian: los boards se abren también en Obsidian.

## Módulos y orden

| #   | Carpeta               | Qué resuelve                                                     | Depende de |
| --- | --------------------- | ---------------------------------------------------------------- | ---------- |
| W1  | `workspace-files`     | Bóveda, índice, carpetas, archivos, subir, mover, papelera, UI   | nada       |
| W2  | `workspace-notes`     | Notas en la bóveda, migración, editor, imágenes en notas         | W1         |
| W3  | `workspace-boards`    | Lienzo con nodos, conexiones, zoom, autoguardado en `.canvas`    | W1         |
| W4  | `workspace-mcp`       | Claude lee, escribe y organiza la bóveda y los boards            | W1, W2, W3 |
| W5  | `workspace-obsidian`  | Modo limpio, explorador, atajo, título = nombre, canvas y grupos | W1 a W4    |
| W6  | `consultora-obsidian` | Toda la ventana de Consultora con el tema y el marco de Obsidian | W5         |

## Patrón

Igual que el resto de la app: tipos en `src/shared/workspace.ts`, modelo y migración, servicio con
`AppError` y `transactionGuard`, controlador, rutas, IPC y preload, herramientas MCP y UI con los
primitivos de `src/renderer/src/ui`. El disco entra por un puerto `vault.ts` para poder probarlo
con una carpeta temporal.

## Migraciones

1. `CreateWorkspace` crea `workspace_items` y `workspace_refs`.
2. `MoveNotesToVault` no es de esquema: lo ejecuta el arranque una sola vez. Escribe cada nota como
   archivo, crea su fila en el índice con el mismo id y renombra `notes` a `notes_legacy` como
   respaldo.

## Verificación

La hace el dueño: `npm install`, `typecheck`, `lint`, `test`, `service:install`, reiniciar Claude y
recorrer la lista de cada módulo.
