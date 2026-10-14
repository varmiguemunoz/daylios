# Tareas · N0 Bases de la nube y ediciones

## Fase 1 · Decisiones

- [x] 1. ADR-01 y ADR-03 escritos con lo decidido: Supabase, Supabase Auth y `services/cloud`.
- [x] 2. ADR-02 motor de sincronización, con prueba corta de dos clientes SQLite editando el mismo
      registro sin conexión y reconectando, en el microservicio y en PowerSync.
- [x] 3. ADR-05 edición simultánea, ADR-06 despliegue con la prueba de NestJS en un Worker y
      ADR-07 seguridad con RLS.
- [x] 4. El dueño aprueba los ADRs; se actualiza la tabla de decisiones del roadmap.

## Fase 2 · Ediciones y puertos

- [x] 5. `src/shared/edition.ts`, `config.edition` por defecto `local`, `Entitlements` en main.
- [x] 6. Puertos `SyncPort`, `FileSyncPort`, `IdentityPort` y `PresencePort` con adaptadores vacíos;
      carga perezosa de `src/main/cloud/` solo en Equipo.
- [x] 7. Ajustes, categoría «Cuenta y equipo» con la edición activa.

## Fase 3 · Tablas

- [x] 8. Revisión de ids globales; migración de los que no lo sean.
- [x] 9. Migración `AddSyncMetadata` con `deleted_at`, `rev`, `org_id` y `updated_by`.
- [x] 10. Borrado suave con el ayudante común en los repositorios; pruebas de que lo borrado no sale
      en listas, búsquedas ni MCP.
- [x] 11. `change_log` y `ChangeRecorder` dentro de `transactionGuard`, con recorte en Local. Pruebas.
- [x] 12. Lista de lo que nunca se sincroniza, como constante probada.

## Fase 4 · Microservicio base

- [x] 13. `services/cloud` con NestJS y la estructura hexagonal, salud, configuración por variables,
      guarda que valida el token de Supabase, migraciones SQL de Supabase en
      `services/cloud/supabase/migrations` con RLS, y contratos en `src/shared/sync-protocol.ts`.
- [x] 14. Revisión estática; documentación de la arquitectura en README y un diagrama en DESIGN.md.

## Checklist

- [ ] La app en Local no abre ninguna conexión de red nueva; lo compruebo con el monitor de red
- [ ] Borro un cliente y no aparece en ningún lado, pero sigue en la tabla con `deleted_at`
- [ ] Cada cambio deja una fila en `change_log`
- [ ] Ajustes muestra «Edición Local»
- [ ] Los ADRs están aprobados y firmados con fecha

## Notas de la implementación

- El registro de cambios usa triggers de SQLite en vez de un `ChangeRecorder` en código: así
  también quedan registradas las escrituras de Claude por MCP, de migraciones y de actualizaciones
  masivas. Se reinstalan al abrir la base porque SQLite borra los triggers cuando una migración
  reconstruye una tabla.
- Borrado suave solo en tablas de registros (`SOFT_DELETE_TABLES`). Enlaces, registros de eventos e
  índice del workspace se borran de verdad y `change_log` guarda la baja.
- `updated_at` no se añadió donde faltaba: la sincronización ordena con la hora de `change_log` y
  el reloj lógico híbrido. `rev`, `org_id` y `updated_by` existen y quedan vacíos en Local.
- El pipeline inicial y el dashboard tenían ids fijos iguales en todas las instalaciones: ahora son
  UUID.
- Lo borrado se purga a los 30 días al arrancar, según ADR-07.
- El microservicio entra con su propio rol y ejecuta cada petición como el usuario, así la RLS
  también lo limita a él.
- Pruebas escritas sin ejecutar: `src/test/change-log.test.ts`, `src/test/edition.test.ts`,
  `src/test/sync-merge.test.ts` y `src/test/cloud-domain.test.ts`.
