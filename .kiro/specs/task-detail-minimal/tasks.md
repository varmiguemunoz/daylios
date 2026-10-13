# Tareas · Detalle de tarea minimalista

- [x] 1. `useIdleExit` y `MarkdownEditor` sin modos: lectura por defecto, doble clic o ⌘E o Enter
      entra, salir por foco, 2 s sin escribir o Esc, cursor recordado, `onCommit`, `SaveLabel` solo
      en guardando o error
- [x] 2. Pasar `onCommit={flush}` en `TaskDetail`, `NoteEditor` y `Document`; Esc de pantalla
      respeta `fromMarkdownEditor` e `isOverlayOpen()`
- [x] 3. `useSubtasks`: sacar de `TaskDetail` la lógica de subtareas
- [x] 4. Partir `TaskTagsEffort` en `EffortPicker` y `TaskTagEditor`
- [x] 5. `TaskSummary` y `TaskDetailsDrawer` con Esfuerzo, Tags y Subtareas; ⌘I
- [x] 6. `TaskDetail` con cabecera mínima: Atrás, Detalles, Borrar, título, fecha, resumen y
      descripción
- [x] 7. `SubtaskProgress` como botón desplegable; `TaskRow` con `expanded`, `onExpand`, → y ←
- [x] 8. `SubtaskDropdown` con su `useReorder`; `useDay.patchProgress`; subtarea abierta desde Hoy vuelve a Hoy
- [x] 9. `TodayView`: estado desplegado por tarea en `localStorage`, `<li>` aparte por desplegable
- [x] 10. impeccable: pasada `critique` del detalle, el panel y la lista desplegada; corregir en
       un lote
- [x] 11. DESIGN.md: editor sin modos, línea de resumen, panel de detalles, subtareas en Hoy

## Checklist

- [ ] Abro una tarea: veo título, fecha, resumen y descripción. No hay Escribir ni Ver
- [ ] Doble clic en la descripción, escribo, espero 2 s: vuelve a lectura y está guardado
- [ ] Entro a editar, hago clic en el título: vuelve a lectura
- [ ] Esc en edición vuelve a lectura; otro Esc vuelve a Hoy
- [ ] Clic en el resumen abre el panel; cambio el esfuerzo y añado una subtarea; cierro con Esc y el
      resumen ya lo muestra
- [ ] En Hoy, clic en `0/3` despliega las subtareas; completo una y la madre pasa a `1/3`
- [ ] Con el teclado: → despliega, ↓ entra en las subtareas, ← vuelve a la madre
- [ ] Cierro y abro el menubar: la tarea sigue desplegada
- [ ] Notas y Documentos también editan con doble clic y vuelven solos a lectura
