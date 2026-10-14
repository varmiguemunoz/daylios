# Tareas · Consultora estilo Obsidian

## Fase 1 · Tokens y marco

- [x] 1. Tokens semánticos en `@theme` con los valores del menubar y su versión Obsidian en el tema
- [x] 2. Tema siempre activo en la ventana de Consultora; `WorkspaceApp` deja de ponerlo y quitarlo
- [x] 3. `shell/AppShell` desde `ObsidianShell`: franja con atrás, adelante, ruta, `Recorder` y «…»
- [x] 4. `SidebarTabs` con `SectionNav` y `FileExplorer`; ancho, visibilidad y pestaña recordados
- [x] 5. `ChromeContext` con `setTitle` y `setMore`; `WorkspaceApp` solo contenido; fuera la barra
      vieja, la cabecera y `ConsultoraNavPanel`
- [x] 6. `GlobalSwitcher` con ⌘K; ⌘O, ⌘[, ⌘], ⌘\ y ⌘, desde cualquier sección

## Fase 2 · Piezas

- [x] 7. `ui/`: IconButton, Kbd, CountBadge, ConfirmButton, SegmentedToggle, SearchField,
      FilterButton, ActionRow, ContextMenu y Breadcrumbs con tokens semánticos
- [x] 8. `Modal` y `Drawer` al estilo Obsidian
- [x] 9. `consultora/ui.tsx`: Page con variantes, Section, Button, EditableText, MarkdownField,
      Select, Pill y estados, ErrorNote, Empty, List, Row y Field; `marketing-ui` igual
- [x] 10. Moléculas nuevas `Properties` y `Table`

## Fase 3 · Pantallas

- [x] 11. Clientes: Clients, Client, Project, Document, Note y DeleteClientModal
- [x] 12. Contactos: Contacts, Contact, ContactFilters, ContactsSection, ConvertToProspectModal,
      InlineField, RefPicker e Initials
- [x] 13. Reuniones: Meetings, Meeting, MeetingSheet y Recorder
- [x] 14. Pipeline: tablero tipo Kanban, tabla, editor de etapas y Prospect
- [x] 15. Tags y Email: Tags, Sources, Rules, Sequences y Newsletters
- [x] 16. Ajustes: SettingsHub, Settings y SettingsEmail como los de Obsidian
- [x] 17. Search y los componentes compartidos que se ven en Consultora: NoteEditor, NotePicker,
      RelatedNotesSection y RelatedChips

## Fase 4 · Revisión

- [x] 18. Revisión estática: imports, prettier y búsqueda de restos en Consultora como
      `rounded-full` fuera de puntos y avatares, `shadow-[`, `font-extrabold` y `bg-apricot`
- [x] 19. Comprobar que los tokens nuevos dejan el menubar igual
- [ ] 20. impeccable `critique` y `polish` con tus capturas; un lote de arreglos
- [x] 21. DESIGN.md: la ventana de Consultora usa el tema Obsidian; PRODUCT.md; README con atajos

## Checklist

- [ ] Paso de Clientes al workspace y a Pipeline y el marco no se mueve
- [ ] La barra lateral tiene Secciones y Archivos; ⌘\ la oculta; el ancho se recuerda
- [ ] Desde Clientes abro un archivo en Archivos y llego al workspace con ese archivo
- [ ] ⌘K encuentra un cliente, un contacto y una nota; Enter los abre
- [ ] Grabo una reunión, cambio de sección y la grabación sigue; la franja muestra REC
- [ ] La ficha de un cliente se lee como una nota con propiedades
- [ ] El menubar se ve igual que antes
- [ ] A 860 px de ancho nada se solapa
