# Diseño · N0 Bases de la nube y ediciones

## 1 · Arquitectura

```
renderer ── IPC ── main
                    ├─ servicios locales (sin cambios de lógica)
                    │    └─ repositorios ── SQLite
                    │          └─ change_log (misma transacción)
                    ├─ puertos: SyncPort · FileSyncPort · IdentityPort · PresencePort · Entitlements
                    │    ├─ Local: adaptadores vacíos (por defecto)
                    │    └─ Equipo: src/main/cloud/* (carga perezosa con import dinámico)
                    └─ MCP y API local: igual que hoy
                                  │
                         Equipo ──┼── Supabase Auth: inicio de sesión, tokens
                                  ├── services/cloud, NestJS hexagonal
                                  │      ├─ sincronización, organizaciones, invitaciones,
                                  │      │  permisos, ediciones, URLs de archivos
                                  │      └─ habla con Supabase PostgreSQL con su propio rol
                                  ├── Supabase Realtime: avisos de cambios y presencia por organización
                                  └── almacén de archivos (ADR-04)
```

- `src/main/cloud/` no se importa desde ningún servicio. Lo carga `index.ts` con `import()` solo si
  `config.edition === 'team'`.
- Microservicio en el mismo repositorio, `services/cloud`, con su propio `package.json`. Contratos
  compartidos en `src/shared/sync-protocol.ts`, importados por la app y por el servicio.
- Estructura hexagonal:

```
services/cloud/src/
  domain/        entidades y reglas puras: Organization, Membership, Mutation, Entitlement
  application/   casos de uso: PushMutations, PullChanges, Invite, AcceptInvite…
  ports/         interfaces: Repositories, Clock, Mailer, Realtime, ObjectStorage, Identity
  adapters/
    http/        controladores NestJS, guardas que validan el token de Supabase
    postgres/    repositorios sobre Supabase PostgreSQL
    supabase/    Realtime, Storage, Auth
    mail/        envío de invitaciones
  main.ts        arranque NestJS; la única parte atada al framework
```

- La app nunca habla con PostgreSQL directo. Lee y escribe por el microservicio; de Supabase usa
  directamente Auth para iniciar sesión y Realtime para recibir avisos y presencia.
- RLS por organización en todas las tablas como segunda barrera, aunque el microservicio ya
  filtra.

## 2 · Metadatos de sincronización

Columnas nuevas en las tablas sincronizables, en una sola migración `AddSyncMetadata`:

| Columna      | Uso                                                                   |
| ------------ | --------------------------------------------------------------------- |
| `updated_at` | ya existe en casi todas; se añade donde falte                         |
| `deleted_at` | borrado suave; las consultas filtran `deleted_at IS NULL`             |
| `rev`        | reloj lógico híbrido, texto ordenable: tiempo, contador y dispositivo |
| `org_id`     | organización dueña; vacío en Local                                    |
| `updated_by` | usuario que hizo el último cambio; vacío en Local                     |

Tablas sincronizables: clientes, proyectos, reuniones, prospectos, pipelines, etapas, contactos,
tags, reglas, fuentes sin secretos, secuencias, newsletters, tareas, relaciones de notas, índice
del workspace, eventos de etapa y dashboards.

Nunca se sincronizan: `settings.json`, claves de API, tokens, `ui-state.json`, cola de voz, estado
de grabación y `outbox` del email.

**Registro de cambios:** tabla `change_log` con `seq`, `entity`, `entity_id`, `op` de alta, cambio
o baja, `fields` cambiados, `rev` y `at`. Lo escribe un `ChangeRecorder` llamado dentro de
`transactionGuard`, así no hay cambio sin registro. En Local se recorta a 10 000 filas.

**Ids:** se revisa que todos sean únicos globalmente; los que dependan de un contador se migran.

## 3 · Ediciones y permisos

`src/shared/edition.ts`: `Edition = 'local' | 'team'` y `Capability = 'cloud.sync' |
'cloud.files' | 'org.invite' | 'realtime.presence'`. `Entitlements.can(capability)` en main:

- Local: siempre falso.
- Equipo: lo que diga el servidor para la organización, guardado en caché con caducidad. Si el
  servidor no responde se usa la última respuesta válida.

## 4 · ADRs

Plantilla en `adr/TEMPLATE.md`: contexto, opciones, criterios con peso, prueba corta, decisión,
consecuencias y cómo deshacerla.

Criterios comunes: funciona sin conexión con SQLite local; latencia de propagación menor a 2 s;
costo con 1, 10 y 100 organizaciones; dependencia de un proveedor; esfuerzo de operación; encaje
con NestJS, Go y PostgreSQL; seguridad y privacidad; permite cobrar por la edición Equipo.

| ADR    | Opciones a evaluar                                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-01 | Decidido: Supabase y microservicio NestJS. El ADR documenta la decisión y sus límites                                                                          |
| ADR-02 | Registro de cambios propio en el microservicio con avisos por Supabase Realtime · PowerSync sobre Supabase · CRDT con Automerge o Yjs                          |
| ADR-03 | Decidido: Supabase Auth. El ADR fija métodos, duración de sesión y flujo de escritorio                                                                         |
| ADR-05 | Último en guardar gana por campo con copia de conflicto en archivos · CRDT para notas y boards                                                                 |
| ADR-06 | Worker de Cloudflare, con la prueba de que NestJS corre ahí · servidor o contenedor en Fly.io, Render, Railway o VPS; región de Supabase y copias de seguridad |
| ADR-07 | Cifrado en tránsito y en reposo · cifrado de extremo a extremo opcional · retención y borrado                                                                  |

Recomendación inicial para ADR-02, a confirmar con la prueba corta: registro de cambios propio en
el microservicio, con último en guardar gana por campo y reloj lógico híbrido, porque los datos son
registros con campos y encaja con el `outbox` que ya existe; los avisos de cambios van por un canal
de Supabase Realtime por organización. PowerSync se compara porque resuelve SQLite contra Supabase,
pero añade un servicio de pago y su propio modelo.

## 5 · Riesgos

- Borrado suave en todas las tablas: muchas consultas que tocar. Se hace con un ayudante común en los
  repositorios y pruebas de que lo borrado no aparece.
- El registro de cambios añade escrituras: se mide con el board de prueba de 500 tarjetas.
