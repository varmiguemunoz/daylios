# Tareas

## Datos
- [x] 1. Migración `AddTagsEffortContacts` + modelos (task, prospect, meeting, contact)

## Tareas: tags, esfuerzo, orden
- [x] 2. `shared/tasks.ts`: Effort, parseCapture, cleanTag; servicio: tags/effort/reorder/tags()
- [x] 3. IPC + preload + `useDay` (parseCapture, reorder)
- [x] 4. `useReorder.ts`; TodayView/TaskRow: arrastrar, ⌥↑/⌥↓, chips, barras de esfuerzo
- [x] 5. TaskDetail: editor de tags con sugerencias + selector de esfuerzo; Historial muestra chips

## Pipeline
- [x] 6. `ProspectService.move(ref, stage, index)` + posición; Pipeline con arrastrar

## Contactos
- [x] 7. Modelo, servicio, controlador, rutas, IPC
- [x] 8. Pantallas Contactos + Contacto; sección en Cliente y Prospecto; sugerencias en participantes
- [x] 9. Ganar prospecto → contactos al cliente

## Subir grabaciones
- [x] 10. `recording.import()`, duración con ffmpeg, idioma en Whisper; idioma en StopSheet
- [x] 11. Reuniones: «Subir grabación», soltar archivo, ImportSheet

## Claude y docs
- [x] 12. MCP: tags/effort en tareas, `list_contacts`, `get_contact`, `save_contact`, `import_recording`
- [x] 13. README, DESIGN.md

## Verificación (dueño)
- [ ] 14. `npm install`, `typecheck`, `lint`, `service:install`
- [ ] 15. Escribir «Propuesta Acme #ventas !alto», arrastrar filas, arrastrar en pipeline, crear contacto, subir un video en inglés
