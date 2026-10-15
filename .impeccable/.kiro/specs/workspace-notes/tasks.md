# Tareas · W2 Notas en la bóveda

- [x] 1. `NoteService` sobre `WorkspaceService`, misma interfaz; conflicto por mtime
- [x] 2. `notes-to-vault.ts` idempotente y su prueba; llamada en el arranque
- [x] 3. Renombre del archivo por título al salir de la nota
- [x] 4. `vault://path/` en el protocolo; `Markdown` resuelve imágenes relativas
- [x] 5. Pegar y arrastrar imágenes en `MarkdownEditor`; `workspace.attach`
- [x] 6. `NoteScreen` del workspace; aviso de conflicto en `NoteEditor`
- [x] 7. Notas de voz y MCP de notas siguen pasando por `NoteService`; revisar pruebas existentes
- [x] 8. DESIGN.md: aviso de conflicto, imágenes en notas

## Checklist

- [ ] Tras actualizar, mis notas anteriores están en `Notas rápidas/` con su fecha y relaciones
- [ ] Creo una nota en el menubar: aparece en el workspace y en Finder
- [ ] Pego una captura en una nota: se guarda en `Adjuntos/` y se ve al volver a lectura
- [ ] Edito la nota en otro editor mientras está abierta: la app avisa y no pisa nada
- [ ] Una nota de voz cae en `Notas rápidas/`
