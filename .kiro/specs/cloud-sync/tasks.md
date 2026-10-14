# Tareas · N3 Sincronización de datos en la nube

## Fase 1 · Protocolo y servidor

- [x] 1. `src/shared/sync-protocol.ts` con versión, mutaciones, empuje, recepción y aviso.
- [x] 2. Tablas del servidor por entidad, `mutations` y `server_seq`.
- [x] 3. `PushMutations` con permisos, idempotencia y último en guardar gana por campo. Pruebas.
- [x] 4. `PullChanges` y `Bootstrap` paginados. Pruebas.
- [x] 5. Aviso por el canal de Supabase Realtime de la organización, con autorización del canal.

## Fase 2 · Cliente

- [x] 6. `cloud/hlc.ts` con pruebas de orden entre dispositivos.
- [x] 7. `SyncEngine` con agrupación, reintentos, cursor y cola persistente.
- [x] 8. `ChangeApplier` sin eco en `change_log` y con `data-changed` por entidad.
- [ ] 9. Índices fraccionarios para posiciones, con migración.
- [x] 10. Arranque inicial con progreso; llevar los datos de Local a la organización.

## Fase 3 · Interfaz

- [x] 11. Indicador de estado en la franja y su panel.
- [x] 12. Asistente de crear o unirse con elección de datos.
- [ ] 13. Borrador protegido y aviso de cambio remoto en los campos que se editan.
- [x] 14. Aviso de registro borrado por otro con restaurar.

## Fase 4 · Cierre

- [x] 15. Prueba de punta a punta con dos copias de la app y el servidor local: crear, editar,
      borrar, sin conexión y reconectar.
- [x] 16. Revisión estática y de seguridad; README con cómo levantar el servidor en local.

## Checklist

- [ ] En dos Macs con la misma organización, creo un cliente en una y aparece en la otra en menos de
      2 segundos
- [ ] Apago el wifi, edito tres cosas, lo enciendo y llegan las tres
- [ ] Los dos cambiamos campos distintos del mismo prospecto y quedan los dos cambios
- [ ] Reordenamos tareas a la vez y ninguna se pierde ni se duplica
- [ ] Pauso la sincronización y el indicador lo dice; al reanudar se envía todo
- [ ] Mi API key de OpenAI no está en el servidor

## Notas de la implementación

- Servidor genérico en vez de una tabla por entidad: `mutations` guarda cada cambio con su
  `mutation_id` único y `records` el estado fusionado de cada registro con la revisión de cada campo.
  El servidor no necesita conocer el esquema de la app, así una versión nueva de la app no exige
  migrar Supabase. La fusión es la misma `applyMutation` en la app y en el servidor.
- Los envíos de una organización se serializan con un bloqueo de PostgreSQL, así el cursor nunca
  salta un cambio que aún no se había confirmado.
- En la app los cambios salen del `change_log` que ya existe. Los cambios que llegan se aplican sin
  volver a entrar en ese registro, con la función `daylios_syncing()` en los triggers.
- Los borrados suaves viajan como el campo `deleted_at`, así una edición de otro campo no resucita un
  registro borrado. Los enlaces se borran con una mutación de baja.
- Tarea 9 pendiente: no se pasaron las posiciones a índices fraccionarios. Las filas se identifican
  por id, así que dos reordenamientos a la vez no pierden ni duplican tareas; como mucho dos quedan
  con la misma posición. La prueba de punta a punta lo comprueba.
- Tarea 13 parcial: los campos de texto conservan el borrador mientras se edita, pero aún no muestran
  «Ana cambió esto». Queda para N5, con la actividad.
- El índice del workspace no se sincroniza hasta N4, porque sin los archivos cada copia lo borraría.
  `folder_path` de clientes tampoco: cada Mac crea su carpeta.
- El techo de 8 tareas cuenta por responsable. En una organización, las tareas nuevas son tuyas y
  Hoy muestra las tuyas y las sin responsable.
- Al crear una organización desde Local se puede llevar todo: se copia la base con `VACUUM INTO` y la
  bóveda, y se sube una foto completa. Al unirse se descarga todo con progreso.
- Prueba de punta a punta escrita sin ejecutar: `src/test/sync-end-to-end.test.ts`, con dos bases
  SQLite y el caso de uso real del servidor sobre un almacén en memoria.
