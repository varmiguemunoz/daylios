# Tareas · Workspace estilo Obsidian

## Fase 1 · Shell y atajo

- [x] 1. Tema `.theme-obsidian` en `main.css` con los tokens y los colores de canvas
- [x] 2. `ConsultoraApp`: cromo por pantalla; workspace sin barra lateral ni cabecera
- [x] 3. `ObsidianShell`, `Ribbon`, franja arrastrable con REC, `ConsultoraNavPanel`
- [x] 4. `workspace-shortcut.ts`, ajuste `workspaceShortcut`, Ajustes y `consultora:navigate` con
      `workspace`

## Fase 2 · Explorador y notas

- [x] 5. `tree()` con archivos; `FileExplorer` con guías, plegado, arrastrar y soltar
- [x] 6. Abrir reemplaza en vez de apilar; `EmptyWorkspace` con recientes; vista de carpeta como
      secundaria
- [x] 7. `QuickSwitcher` con ⌘O y ⌘F
- [x] 8. Título igual a nombre en todas las notas; renombrar reescribe el título; pruebas
- [x] 9. `NoteEditor variant="document"` para el workspace

## Fase 3 · Canvas

- [x] 10. `base.css` en lugar de `style.css`; `CanvasCard` memorizado; `ObsidianEdge`
- [x] 11. `EdgeHandles`, `ResizeEdges`, crear tarjeta conectada al soltar en el vacío
- [x] 12. `CardToolbar` con arrastrar al lienzo, `CanvasControls`, `SelectionMenu`
- [x] 13. `shared/canvas-groups.ts` con pruebas; mover con contenido; ⌘G; borrar con pregunta
- [x] 14. Cuadrícula de 20 px con ⌥ libre; flechas; ⌘A
- [x] 15. Rendimiento: guardar por instantánea, nivel de detalle por zoom, board de 500 tarjetas

## Fase 4 · Pulido

- [ ] 16. impeccable `polish` y `optimize` sobre el workspace con tus capturas; un lote de arreglos
- [x] 17. DESIGN.md: sección Workspace con el tema Obsidian; PRODUCT.md; README

## Checklist

- [ ] ⌥⌘W desde otra app abre el workspace con la última nota; otra vez lo oculta
- [ ] En el workspace no veo la barra de Consultora ni la cabecera; la cinta abre la navegación
- [ ] Escribo `# Plan de ventas` en una nota nueva: al salir el archivo se llama «Plan de ventas»
- [ ] Selecciono 4 tarjetas, ⌘G, escribo el nombre; muevo el grupo y se mueven las 4
- [ ] Abro el mismo board en Obsidian: grupos, colores y flechas iguales
- [ ] Con 500 tarjetas, zoom y desplazamiento van fluidos; de lejos el texto se ve como barras
