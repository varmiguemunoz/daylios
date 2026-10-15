# Tareas · Administración de tags

- [x] 1. Migración `AddTagAudience`; `audience` en `TagModel` y `Tag`
- [x] 2. `ResendGateway.deleteSegment`; outbox `segment_delete`; `MarketingSync` lo procesa
- [x] 3. Segments solo para audiencias en `marketing-sync` y `newsletter.service`; `HubConfig.audience`
- [x] 4. `TagService.remove` (bloqueo por automatizaciones/reglas activas) y `setAudience`
- [x] 5. `TaskService.tagSummaries`, `renameTag`, `removeTag`
- [x] 6. Rutas, controladores, IPC y preload (`marketing.removeTag`, `setTagAudience`,
      `tasks.tagSummaries`, `renameTag`, `removeTag`)
- [x] 7. Pantalla `Tags` + entrada en la barra lateral; evento `tags:changed` en filtros
- [x] 8. MCP: `list_tags.kind`, `rename_tag`, `set_tag_audience`, `delete_tag`, `rename_task_tag`,
      `delete_task_tag`
- [x] 9. DESIGN.md: pantalla Tags y toggle Audiencia

## Checklist

- [ ] Borrar un tag con 0 contactos desaparece de todos los filtros sin recargar la ventana
- [ ] Borrar un tag usado por una automatización activa muestra cuál y no borra
- [ ] Marcar «newsletter» como audiencia crea su Segment; desmarcar `origen-web` lo borra en Resend
- [ ] Renombrar `#ventas` a `#comercial` en tareas: todas cambian; si `#comercial` existía, se fusionan
