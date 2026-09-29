# Diseño · Persistencia SQLite + servidor local + MCP

## Vista general

```
Renderer (React) ──IPC──┐
                        ▼
                  TaskService  ← reglas (techo 8, validación, mover)
                        ▼
                  TaskRepository ← SQL
                        ▼
                  SQLite (node:sqlite, WAL)
                        ▲
Claude Desktop ─stdio─ MCP ─HTTP+token─ Local API (dentro de la app)
```

El proceso principal de Electron es el **único dueño** de la base de datos. La UI y Claude pasan por el mismo `TaskService`, así las reglas no se duplican y no hay dos procesos escribiendo el archivo.

El MCP no toca SQLite: es un traductor fino de herramientas a llamadas HTTP. Por eso no tiene dependencias nativas y corre con cualquier Node.

## Estructura

```
src/shared/tasks.ts          Tipos, contrato TasksApi, techo, utilidades de fecha, resumen del día
src/main/
  index.ts                   Arranque: une las piezas
  window.ts                  Ventana tipo popover + icono del menubar
  db/database.ts             Abrir SQLite + migraciones (PRAGMA user_version)
  tasks/taskRepository.ts    Consultas SQL, mapeo fila ↔ Task
  tasks/taskService.ts       Reglas de negocio + TaskError
  adapters/ipc.ts            ipcMain.handle('tasks:*') → servicio
  adapters/localApi.ts       Servidor HTTP 127.0.0.1 + token → servicio
src/mcp/index.ts             Servidor MCP stdio → HTTP
src/preload/index.ts         Expone window.api.tasks (invoke) y eventos
src/renderer/src/lib/api.ts  Acceso a window.api
```

## Datos

```sql
CREATE TABLE tasks (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  date         TEXT NOT NULL,         -- YYYY-MM-DD local
  done         INTEGER NOT NULL DEFAULT 0,
  position     INTEGER NOT NULL,
  created_at   TEXT NOT NULL,         -- ISO
  completed_at TEXT,
  carried_from TEXT
);
CREATE INDEX idx_tasks_date ON tasks(date, position);
```

Migraciones: lista ordenada en `database.ts`; se aplica cada una con índice > `user_version`.

## Servicio

`TaskService` implementa `TasksApi` (el mismo contrato que usa la UI) más `getDaySummary` y `carryOver`.
Errores de negocio: `TaskError(code, message)` con `code ∈ {invalid, not_found, day_full}`. Los adaptadores lo traducen (HTTP 400/404/409; IPC propaga el mensaje).

## API local

| Método | Ruta | Cuerpo / query |
|---|---|---|
| GET | `/day?date=` | → resumen del día |
| GET | `/history?from=&to=&page=&pageSize=` | → HistoryPage |
| POST | `/tasks` | `{ title, date? }` |
| PATCH | `/tasks/:id` | `{ title?, done? }` |
| DELETE | `/tasks/:id` | |
| POST | `/tasks/:id/move` | `{ date }` |
| POST | `/carry-over` | `{ from?, to? }` (por defecto ayer → hoy) |

- Escucha en `127.0.0.1:0` (puerto libre). Escribe `{ port, token }` en `userData/connection.json` con modo `600`.
- `Authorization: Bearer <token>` obligatorio; comparación en tiempo constante.
- Cuerpo máximo 16 KB.
- Tras cada mutación llama a `onChange()` → la ventana recibe `tasks:changed` y recarga.

## MCP

- `@modelcontextprotocol/sdk` + `zod`, transporte stdio.
- Lee `connection.json` en cada llamada (la app puede reiniciarse y cambiar de puerto).
- Ruta por defecto: `~/Library/Application Support/daily-os/connection.json`; se puede sobreescribir con `DAYLIOS_CONNECTION`.
- Se compila como segunda entrada del build de `main` → `out/main/mcp.js`.

Config de Claude Desktop (desarrollo):
```json
{ "mcpServers": { "daylios": { "command": "node", "args": ["<repo>/out/main/mcp.js"] } } }
```
Empaquetada: `command` = binario de la app, `env: { "ELECTRON_RUN_AS_NODE": "1" }`, `args` = `.../app.asar/out/main/mcp.js`.

## Renderer

- `api.ts` usa `window.api.tasks` directamente; se borra `localStore.ts` y la semilla demo.
- `useDay` escucha `tasks:changed` para recargar; "Traer todas" usa `carryOver` (una sola operación en vez de un bucle).
- Se quita el parámetro `?view=` de previsualización.

## Seguridad
- Solo loopback + token aleatorio de 32 bytes + archivo con permisos de usuario. Otra app local con permisos del mismo usuario podría leer el token; aceptable para uso personal.
- SQL siempre con parámetros.
