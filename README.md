# DayliOS

Tareas del día (máximo 8) en el menubar de macOS. SQLite local y servidor MCP para Claude Desktop.

## Uso

```bash
npm install
npm run dev        # desarrollo
npm run build:mac  # genera el .dmg en dist/
```

Datos: `~/Library/Application Support/daily-os/daylios.db`

## Instalar como servicio (macOS)

```bash
npm run service:install     # compila, copia a /Applications, arranca siempre y configura el MCP en Claude
npm run service:uninstall   # quita todo (pregunta antes de borrar tus tareas; --purge para no preguntar)
```

El servicio es un LaunchAgent (`~/Library/LaunchAgents/com.bloomilite.daylios.plist`): arranca al iniciar sesión y, si la app se cierra o falla, launchd la vuelve a abrir. Logs en `~/Library/Logs/daylios.log`. Después de instalar o desinstalar, reinicia Claude (⌘Q) para que cargue el cambio del MCP.

## Arquitectura

```
src/shared/            dominio: tipos, contrato TasksApi, techo de 8, fechas
src/main/
  index.ts             arranque
  window.ts            ventana popover + icono del menubar
  ipc.ts               UI → servicio
  server.ts            Express (127.0.0.1 + token) → lo usa el MCP
  db/                  DataSource de TypeORM + migraciones
  models/              M: modelo Task (EntitySchema)
  views/               V: forma del JSON
  controllers/         C: petición → servicio → vista
  routes/              rutas → controlador
  services/            reglas del día (techo 8, validar, mover)
  guards/              transacciones: todo o nada, de una en una
  middlewares/         token, aviso a la ventana, errores
src/mcp/               servidor MCP stdio → API local
src/preload/           puente seguro window.api
src/renderer/          UI React
```

Specs (SDD) en `.kiro/specs/`. El refactor a Express + TypeORM y el diagnóstico están en `.kiro/specs/express-typeorm-server/`.

La app es la única que abre la base de datos. La UI y Claude pasan por el mismo servicio, así que las reglas (techo de 8, validación) son idénticas. Si Claude cambia algo, la ventana se refresca sola.

Al arrancar, la app escribe `connection.json` (puerto + token, permisos 600) junto a la base de datos. El MCP lo lee en cada llamada. **La app tiene que estar abierta** para que Claude pueda usarla; con `npm run service:install` queda siempre corriendo.

## Conectar Claude Desktop

Edita `~/Library/Application Support/Claude/claude_desktop_config.json` y reinicia Claude.

Desarrollo (después de `npm run build` o `npm run dev`):

```json
{
  "mcpServers": {
    "daylios": {
      "command": "node",
      "args": ["/Users/varmiguemunoz/varmiguemunoz/daily-os/out/main/mcp.js"]
    }
  }
}
```

App instalada en `/Applications`:

```json
{
  "mcpServers": {
    "daylios": {
      "command": "/Applications/daily-os.app/Contents/MacOS/daily-os",
      "args": ["/Applications/daily-os.app/Contents/Resources/app.asar/out/main/mcp.js"],
      "env": { "ELECTRON_RUN_AS_NODE": "1" }
    }
  }
}
```

### Herramientas

| Herramienta | Qué hace |
|---|---|
| `get_day` | Tareas del día + resumen (total, hechas, pendientes, huecos libres, techo). Sin fecha = hoy |
| `get_history` | Historial por días, paginado, filtrable con `from` / `to` |
| `create_task` | Crea una tarea (falla si el día ya tiene 8) |
| `update_task` | Cambia el título y/o marca como hecha o pendiente |
| `delete_task` | Elimina una tarea |
| `move_task` | Mueve una tarea a otro día |
| `carry_over_pending` | Mueve las pendientes de un día a otro (por defecto de ayer a hoy) |

Ejemplo de tarea programada al final del día: *"Usa get_day para ver hoy. Resume lo hecho y lo pendiente, y usa carry_over_pending de hoy a mañana."*
