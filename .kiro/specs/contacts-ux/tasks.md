# Tareas · Contactos (UX)

- [x] 1. Migración `AddContactProject`; `projectId` en modelo y tipos; validación cliente ↔ proyecto
- [x] 2. `ContactService.list` con `tags[]`, `inPipeline`, teléfono; `get` con `project`, `prospect`
      (pipeline y etapa) y `runs`; `convert` (pipeline, etapa, empresa, valor); `detachProspect`
- [x] 3. `RefPicker` (molecule): selector con búsqueda para cliente, proyecto y prospecto
- [x] 4. Rutas, IPC, preload (`convertContact`, `detachContactProspect`)
- [x] 5. UI lista: `SearchField` + `FilterButton` + `Drawer` con `ContactFilters`; filas con `Initials`
- [x] 6. UI ficha: `ContactHeader`, `ContactSidebar`, `InlineField`, `Timeline`; menú «Más»
- [x] 7. `ConvertToProspectModal` (ficha y fila)
- [x] 8. MCP: `list_contacts` ampliado, `convert_contact` (+alias), `detach_contact_prospect`,
      `delete_contact`, `save_contact.project`
- [x] 9. impeccable: pasada `critique` sobre la lista y la ficha y corregir en un solo lote
- [x] 10. DESIGN.md: lista y ficha de contacto

## Checklist

- [ ] La pantalla Contactos muestra solo buscador, Filtros y lista; Filtros abre el panel derecho
- [ ] Filtrar por 2 tags devuelve solo quien tiene ambos; el botón muestra «Filtros 2»
- [ ] Relaciones: cliente, proyecto y prospecto se asignan con `RefPicker`; «Convertir en prospecto»
      crea el prospecto en el pipeline y etapa elegidos y la ficha pasa a «Ver en pipeline»
