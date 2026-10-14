# Tareas · N5 Actividad del equipo en tiempo real

## Fase 1 · Presencia

- [x] 1. Presencia en el canal de Supabase Realtime de la organización, con autorización del canal.
- [x] 2. `PresenceService` en main, IPC y `PresenceStack` en la franja y en las fichas.
- [x] 3. Aviso «está editando» desde los editores y el board.

## Fase 2 · Actividad

- [x] 4. Tabla `activity`, escritura desde los casos de uso y agrupación de ráfagas.
- [x] 5. Descarga por cursor y `activity_cache` local.
- [x] 6. Pestaña «Actividad» con `ActivityFeed`, filtros y contador de novedades.
- [x] 7. Actividad de cada ficha.

## Fase 3 · Avisos y en vivo

- [x] 8. Avisos del sistema por asignación y su configuración en Ajustes.
- [x] 9. `data-changed` por entidad, recarga en segundo plano y resaltado.

## Fase 4 · Cierre

- [x] 10. Prueba de punta a punta con dos copias; revisión estática; DESIGN.md con presencia y
      actividad; README.

## Checklist

- [ ] Veo las iniciales de otro miembro en la franja cuando se conecta y desaparecen al cerrar
- [ ] Abrimos el mismo cliente y cada uno ve al otro en la ficha
- [ ] Mueve un prospecto a Ganado y lo veo en Actividad y en mi Pipeline al instante
- [ ] Me asigna una tarea y me llega el aviso; clic y se abre la tarea
- [ ] La lista de contactos se actualiza con un cambio suyo sin perder mi scroll

## Notas

- La presencia usa su propio canal `org:<id>:presence` para no mezclarse con el aviso de cambios.
- El «está editando» se detecta al escribir en la pantalla abierta, sin tocar cada editor, y se
  apaga a los 2 s sin escribir.
- La actividad se deduce en el servidor de los cambios que llegan; invitaciones y altas salen de la
  auditoría con un trigger. La siembra inicial no genera actividad.
- El aviso por respuestas en algo tuyo queda para V2, junto con los comentarios.
- Las listas ya recargaban sin perder el scroll; lo nuevo es el resaltado.
- Las pruebas `activity-domain` y `activity-end-to-end` están escritas en `src/test` y no se han
  corrido.
