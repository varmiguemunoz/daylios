# Diseño · Servidor Express + TypeORM

## Vista general

```
Renderer (React) ──IPC──► ipc.ts ─────────────┐
                                              ▼
Claude ─stdio─► MCP ─HTTP+token─► Express     TaskService  (reglas: techo 8, validación, mover)
                 server.ts → routes → controllers ─┘   │
                                  └─► views (JSON)     ▼
                                           transactionGuard (escrituras)
                                                       ▼
                                           TypeORM Repository<Task> ─► SQLite (better-sqlite3)
```

La app (proceso main de Electron) es la única que abre la base. UI y Claude pasan por el mismo `TaskService`.

## Estructura (`src/main/`)

| Archivo | Rol | Qué contiene |
|---|---|---|
| `index.ts` | Arranque | Abre la base, crea servicio, ventana, IPC y servidor |
| `window.ts` | Electron | Ventana popover + icono del menubar (sin cambios) |
| `ipc.ts` | Adaptador UI | Un `ipcMain.handle` por método, escrito explícito |
| `server.ts` | Express | Middlewares + rutas + `listen` + `connection.json` |
| `db/data-source.ts` | Persistencia | `DataSource` de TypeORM (better-sqlite3, migraciones al arrancar) |
| `db/migrations/CreateTasks.ts` | Esquema | Crea `tasks` con `Table` de TypeORM (`ifNotExist`) |
| `models/task.model.ts` | **M** | `EntitySchema<Task>`: columnas e índice |
| `views/task.view.ts` | **V** | Forma del JSON: `taskView`, `dayView`, `errorView` |
| `controllers/task.controller.ts` | **C** | Lee `req`, llama al servicio, responde con la vista |
| `routes/task.routes.ts` | Rutas | Método + ruta → método del controlador |
| `services/task.service.ts` | Reglas | Validación, techo 8, mover, arrastrar, historial, `TaskError` |
| `guards/transaction.guard.ts` | Guard | Transacción + cola: todo o nada, de una en una |
| `middlewares/auth.middleware.ts` | Seguridad | Token Bearer, comparación en tiempo constante |
| `middlewares/notify.middleware.ts` | UI | Avisa a la ventana tras escrituras exitosas |
| `middlewares/error.middleware.ts` | Errores | `TaskError` → 400/404/409; JSON roto → 400; resto → 500 |

## Decisiones

- **`EntitySchema` en vez de clase con decoradores.** Reutiliza el tipo `Task` de `src/shared`, no necesita
  `experimentalDecorators` ni `emitDecoratorMetadata` (que esbuild/electron-vite no emite) y devuelve objetos planos,
  que viajan por IPC sin sorpresas.
- **Migración con `createTable(…, true)`.** Si la tabla ya existe (base de la versión anterior) no la toca. `synchronize` queda apagado para no alterar tablas solo.
- **Guard = `DataSource.transaction` + cola.** `transaction()` hace COMMIT si `work` termina y ROLLBACK si lanza.
  La cola evita que dos transacciones se mezclen en la única conexión de SQLite.
- **Historial en una sola consulta.** Antes: 1 consulta de fechas + 1 de totales + 1 por día. Ahora: `find` del periodo y
  agrupar en memoria (máx. 8 tareas/día → volumen trivial).
- **Express 5.** Captura errores de handlers `async` sin `try/catch` ni `express-async-handler`.
- **Controlador como clase con métodos flecha** para poder pasar `c.getDay` a la ruta sin perder `this`.

## API (sin cambios de contrato)

| Método | Ruta | Cuerpo / query | Respuesta |
|---|---|---|---|
| GET | `/day?date=` | | `dayView` |
| GET | `/history?from=&to=&page=&pageSize=` | | `HistoryPage` |
| POST | `/tasks` | `{ title, date? }` | 201 `taskView` |
| PATCH | `/tasks/:id` | `{ title?, done? }` | `taskView` |
| DELETE | `/tasks/:id` | | `{ ok: true }` |
| POST | `/tasks/:id/move` | `{ date }` | `taskView` |
| POST | `/carry-over` | `{ from?, to? }` (ayer → hoy) | `{ moved, left }` |

## Empaquetado
- `better-sqlite3` es nativo: `postinstall: electron-builder install-app-deps` lo compila para Electron;
  `npmRebuild: true` y `asarUnpack` lo dejan fuera del `.asar`.
- electron-vite externaliza `dependencies` en el build de main, así TypeORM y Express se cargan de `node_modules`.
- El MCP (`out/main/mcp.js`) no importa TypeORM: sigue corriendo con Node del sistema o `ELECTRON_RUN_AS_NODE`.
