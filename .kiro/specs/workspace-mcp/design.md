# Diseño · W4 Claude en el workspace

Archivo nuevo `src/mcp/tools/workspace.ts` con `register(server)`, sobre las rutas `/workspace/*`
de W1.

| Herramienta               | Qué hace                                                               |
| ------------------------- | ---------------------------------------------------------------------- |
| `workspace_tree`          | Árbol de carpetas con conteos                                          |
| `workspace_list`          | Contenido de una carpeta, por ruta o id                                |
| `workspace_search`        | Por nombre y texto                                                     |
| `workspace_read`          | Nota completa o resumen de un archivo                                  |
| `workspace_write_note`    | Crear o reescribir una nota en una carpeta                             |
| `workspace_create_folder` | Crear carpeta                                                          |
| `workspace_move`          | Mover o renombrar                                                      |
| `workspace_delete`        | Con `confirm: true`, a la Papelera                                     |
| `board_read`              | Nodos y conexiones en forma compacta                                   |
| `board_edit`              | Operaciones: add_node, update_node, remove_node, add_edge, remove_edge |

`board_edit` aplica las operaciones sobre `parseCanvas` y guarda con el mtime leído, así no pisa
cambios abiertos en la app. Las instrucciones del servidor MCP explican la bóveda y `Notas rápidas`.
