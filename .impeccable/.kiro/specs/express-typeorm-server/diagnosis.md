# Diagnóstico · redundancia, sobreingeniería y latencia

Veredicto corto: la app es pequeña y no tenía problemas reales de rendimiento. Lo que sobraba era
**código difícil de leer** (abstracciones genéricas) y **dos efectos de React mal armados**. Todo lo marcado ✅ ya está corregido.

## Backend

| #   | Qué había                                                                                             | Problema                                                    | Estado                                                 |
| --- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| B1  | `taskRepository.ts` con SQL a mano, `PRAGMA user_version`, `BEGIN/COMMIT` manuales                    | SQL plano; migraciones y transacciones caseras              | ✅ TypeORM: repositorio, migración, `transactionGuard` |
| B2  | `localApi.ts`: servidor `http` con tabla de rutas por regex, parseo de JSON y límite de cuerpo a mano | Reinventa Express; difícil añadir una ruta                  | ✅ Express 5 + MVC                                     |
| B3  | Historial: 1 consulta de fechas + 1 de totales + **1 consulta por día**                               | N+1 consultas                                               | ✅ una sola `find` y agrupar en memoria                |
| B4  | `ipc.ts` con `TASK_METHODS` + `apply`, y `preload` con fábrica `call()`                               | Genérico = hay que "descifrarlo"; la lista estaba duplicada | ✅ una línea explícita por canal en ambos              |
| B5  | `summarizeDay` en `shared/`                                                                           | Solo lo usaba el servidor                                   | ✅ movido a `views/task.view.ts` (`dayView`)           |
| B6  | `update` y `remove` sin transacción                                                                   | Leer + escribir fuera de transacción                        | ✅ todas las escrituras pasan por el guard             |
| B7  | `getDaySummary` en el servicio                                                                        | Presentación mezclada con reglas                            | ✅ el controlador arma la vista                        |

## Renderer (efectos y latencia)

| #   | Dónde                                                                 | Problema                                                                                                                                                                                          | Estado                                                       |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| F1  | `UndoToast` + `useDay.clearUndo`                                      | `clearUndo` era una función nueva en cada render → el `useEffect` del toast reiniciaba el temporizador de 6 s **cada vez que algo se re-renderizaba**. Bug real: el toast podía no cerrarse nunca | ✅ `useCallback` estable                                     |
| F2  | `App.tsx` `onKey` con `useCallback([runUndo])`                        | `runUndo` cambiaba en cada render → el `useCallback` no servía y el listener se re-registraba siempre                                                                                             | ✅ `runUndo` estable; efecto simple                          |
| F3  | `TodayView`: `knownIds` + `fresh` (Set) + efecto que compara ids      | Estado extra + un render extra en cada cambio de la lista, solo para una animación                                                                                                                | ✅ `TaskRow` decide al montarse si la tarea es nueva (< 2 s) |
| F4  | `useDay.guard`                                                        | Se llamaba igual que el guard de transacciones                                                                                                                                                    | ✅ renombrado a `safely`                                     |
| F5  | 3 suscripciones a `onWindowShown` (`useToday`, `useDay`, `TodayView`) | Cada una hace algo distinto y es barata                                                                                                                                                           | ⏸ se deja; unificar lo haría menos claro                     |
| F6  | `Meter`: efecto para el brillo de 8/8                                 | Correcto y solo corre al cambiar `done`                                                                                                                                                           | ⏸ se deja                                                    |
| F7  | `HistoryView`: una petición por cambio de filtro/página               | Local por IPC, milisegundos; no necesita debounce                                                                                                                                                 | ⏸ se deja                                                    |
| F8  | `useToday`: intervalo de 60 s                                         | Coste nulo; si el día no cambia, React no re-renderiza                                                                                                                                            | ⏸ se deja                                                    |

## Proyecto (fuera del código)

| #   | Qué                                                                                                                                                                            | Recomendación                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| P1  | La skill _impeccable_ copiada en **10 carpetas** (`.agent`, `.agents`, `.claude`, `.cursor`, `.gemini`, `.github`, `.hermes`, `.kiro/skills`, `.opencode`, …), ~15 MB cada una | Dejar solo la del agente que uses, o meterlas en `.gitignore` |
| P2  | `appId: com.electron.app`, `productName: daily-os` (plantilla)                                                                                                                 | Poner un id propio antes de distribuir                        |
| P3  | Espejo `npmmirror` en `.npmrc` y `electron-builder.yml`                                                                                                                        | Quitar si no lo necesitas; es otra fuente de descargas        |
| P4  | Repo sin commits                                                                                                                                                               | Hacer el primer commit antes de seguir                        |
| P5  | Spec `sqlite-persistence-mcp` con todas las tareas sin marcar                                                                                                                  | Marcar o archivar                                             |

## Riesgos a vigilar al verificar

1. **Compilación de `better-sqlite3`**: `npm install` la hace (`postinstall`). Si falla, instala Xcode Command Line Tools (`xcode-select --install`).
2. **Base antigua**: la migración no toca una tabla `tasks` existente; TypeORM solo añade su tabla `migrations`.
3. **Versiones**: fijé rangos (`typeorm ^0.3.27`, `express ^5.1.0`, `better-sqlite3 ^12.4.1`). Si `npm install` resuelve una mayor con cambios, ajusta ahí.
