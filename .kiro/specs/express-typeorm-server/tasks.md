# Tareas

## Fase 1 · Servidor (hecho, falta que lo verifiques tú)

- [x] 1. Dependencias: `typeorm`, `better-sqlite3`, `express@5`, `reflect-metadata`, `@types/express`; `postinstall` y `npmRebuild` (R1.2)
- [x] 2. `models/task.model.ts`: `EntitySchema<Task>` (R1.4)
- [x] 3. `db/data-source.ts` + `db/migrations/CreateTasks.ts` (R1.1, R1.3)
- [x] 4. `guards/transaction.guard.ts`: transacción + cola (R2)
- [x] 5. `services/task.service.ts`: reglas sobre `Repository<Task>`, escrituras vía guard, historial en 1 consulta (R1.1, R2.1)
- [x] 6. `views/`, `controllers/`, `routes/`, `middlewares/`, `server.ts` en Express (R3)
- [x] 7. `ipc.ts` y `preload/index.ts` explícitos (R4.2)
- [x] 8. Borrar `db/database.ts`, `tasks/`, `adapters/`; mover `summarizeDay` a la vista (R4.1)

## Fase 2 · Renderer (hecho)

- [x] 9. `useDay`: `runUndo` / `clearUndo` estables → el toast de deshacer ya no reinicia su temporizador en cada render (R4.3)
- [x] 10. `App.tsx`: quitar `useCallback` que no servía; el listener de teclado solo se re-registra cuando cambia el deshacer (R4.3)
- [x] 11. `TodayView` / `TaskRow`: quitar el diff de ids (efecto + estado + render extra); la fila anima si se creó hace < 2 s (R4.3)

## Fase 3 · Verificación (tú)

- [ ] 12. `npm install` (compila better-sqlite3 para Electron; requiere Xcode Command Line Tools)
- [ ] 13. `npm run typecheck` y `npm run lint`
- [ ] 14. `npm run dev`: crear, completar, editar, borrar + deshacer, traer de ayer, historial
- [ ] 15. Desde Claude Desktop: `get_day`, `create_task` hasta 8 (la 9.ª debe dar 409), `carry_over_pending`
- [ ] 16. Abrir con una `daylios.db` de la versión anterior y comprobar que las tareas siguen ahí

## Fase 4 · Cierre del producto

- [ ] 17. `electron-builder.yml`: cambiar `appId: com.electron.app` por uno propio (p. ej. `com.bloomilite.daylios`) y `productName: DayliOS`. Ojo: cambiar `productName` cambia la carpeta de datos y la ruta del MCP en el README
- [ ] 18. Revisar `electronDownload.mirror` y `.npmrc` (espejo npmmirror): quitarlos si no los necesitas
- [ ] 19. Limpiar carpetas duplicadas de skills (ver `diagnosis.md`) o añadirlas a `.gitignore`
- [ ] 20. Primer commit (el repo aún no tiene ninguno)
- [ ] 21. `npm run build:mac`, instalar en `/Applications`, actualizar config de Claude Desktop con la ruta instalada
- [ ] 22. Crear las tareas programadas de Claude (07:00 y fin del día) con los textos del README
- [ ] 23. Marcar como hechas las tareas antiguas de `.kiro/specs/sqlite-persistence-mcp/tasks.md` o archivar ese spec
