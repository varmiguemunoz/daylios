# ADR-02 · Motor de sincronización

- Estado: aprobado
- Fecha: 13 oct 2026
- Módulo: N0, construye N3

## Contexto

La edición Equipo comparte clientes, proyectos, reuniones, pipeline, contactos, tareas, tags,
dashboards y el índice del workspace entre varios dispositivos y personas. Cada dispositivo sigue
trabajando con su SQLite sin conexión y se pone al día al reconectar. La edición Local no debe
cambiar ni abrir conexiones. Ya existe un patrón parecido: el `outbox` hacia Resend, que encola
dentro de la transacción y reintenta.

## Opciones

| Opción                         | Cómo funciona                                                                                                                                                                                                                                                                        | A favor                                                                                                                                                                                                                          | En contra                                                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A · Registro de cambios propio | Cada escritura deja una mutación en `change_log` en la misma transacción. El dispositivo las sube al microservicio, que las fusiona en PostgreSQL y aumenta un cursor por organización. Supabase Realtime solo avisa «hay cambios hasta el cursor N» y el dispositivo baja lo nuevo. | Todo en el stack del dueño: NestJS, PostgreSQL, TypeORM. Sin otro proveedor ni otra cuota. Reglas de permisos y de negocio en un solo sitio. Encaja con el `outbox`. Cobrar la edición Equipo es solo un permiso en el servidor. | Hay que escribir y mantener la cola, el cursor, la fusión y los reintentos. Riesgo de errores sutiles si no se prueba bien.                                                                                                                                               |
| B · PowerSync sobre Supabase   | Servicio que replica PostgreSQL hacia un SQLite propio del SDK en cada cliente según reglas de sincronización. Las escrituras suben por una función del backend.                                                                                                                     | Resuelve la lectura incremental y el sin conexión con un SDK maduro.                                                                                                                                                             | Otro proveedor y otra cuenta: Free se desactiva tras una semana sin uso, Pro desde 49 USD al mes. Su SQLite convive con el nuestro y con TypeORM, o obliga a cambiar la capa de datos. El servicio es de licencia FSL. Las escrituras siguen necesitando nuestro backend. |
| C · CRDT con Automerge o Yjs   | Cada registro es un documento CRDT que se fusiona solo.                                                                                                                                                                                                                              | Fusión sin conflictos, incluso letra a letra.                                                                                                                                                                                    | Pensado para documentos, no para tablas con consultas, filtros y métricas en SQL. Habría que guardar los documentos aparte y proyectarlos a tablas. Mucho más complejo para lo que pide V1.                                                                               |

## Criterios

Puntuación de 1 a 5. Peso de 1 a 3.

| Criterio                                   | Peso | A · propio | B · PowerSync | C · CRDT |
| ------------------------------------------ | ---- | ---------- | ------------- | -------- |
| Funciona sin conexión con el SQLite actual | 3    | 5          | 3             | 3        |
| Propagación menor a 2 s                    | 2    | 4          | 5             | 4        |
| Costo con 1, 10 y 100 organizaciones       | 2    | 5          | 3             | 5        |
| Dependencia de un proveedor                | 2    | 5          | 2             | 4        |
| Esfuerzo de operación                      | 2    | 3          | 4             | 2        |
| Encaje con NestJS, PostgreSQL y TypeORM    | 3    | 5          | 2             | 2        |
| Seguridad: permisos en un solo lugar       | 2    | 5          | 3             | 3        |
| Permite cobrar la edición Equipo           | 1    | 5          | 4             | 4        |
| **Total ponderado**                        |      | **79**     | **53**        | **55**   |

Costo estimado de A sobre Supabase Pro: el plan incluye 500 conexiones de Realtime simultáneas y
5 millones de mensajes al mes. Con 100 organizaciones de 5 personas y un aviso por cambio, se queda
dentro de lo incluido. B suma su propio plan encima del de Supabase.

## Prueba corta

Escrita, sin ejecutar todavía por la regla de no correr pruebas en esta sesión:

- `src/shared/hlc.ts`: reloj lógico híbrido, revisión como texto ordenable y rechazo de relojes
  adelantados más de 5 minutos.
- `src/shared/sync-merge.ts`: fusión pura, último en guardar gana por campo, con borrado que gana
  salvo una edición posterior.
- `src/test/sync-merge.test.ts`: dos dispositivos editan el mismo cliente sin conexión. Campos
  distintos se conservan los dos, el mismo campo gana el más reciente, el orden de llegada no
  cambia el resultado y aplicar dos veces el mismo cambio no hace nada.

Para correrla: `npx vitest run src/test/sync-merge.test.ts`.

PowerSync no se probó: su modelo exige su SDK y su SQLite, y eso ya descarta el criterio de mayor
peso sin necesidad de montar la cuenta.

## Decisión

Opción A. Registro de cambios propio en el microservicio, último en guardar gana por campo con reloj
lógico híbrido, y un canal de Supabase Realtime por organización solo para avisar.

Protocolo en `src/shared/sync-protocol.ts`:

- `POST /sync/push` con un lote de mutaciones `{ entity, id, op, fields, rev }`. El servidor
  valida permisos por organización, fusiona con la misma `applyMutation` y devuelve el cursor.
- `GET /sync/pull?since=<cursor>` devuelve las mutaciones posteriores, paginadas.
- Realtime publica `{ cursor }` en `org:<id>`. Sin aviso, el dispositivo consulta cada 60 s.
- El servidor guarda por fila los `rev` de cada campo, para que la fusión sea la misma en todos lados.

## Consecuencias

- Una sola lógica de fusión, compartida por la app y el servicio y probada sin base de datos.
- Escritos de más: cada escritura suma una fila a `change_log`. Se mide en N0 con el board de 500
  tarjetas. En Local se recorta a 10 000 filas.
- Notas y boards son archivos del workspace: los resuelve ADR-05, no este motor.
- Para cambiar a PowerSync más adelante bastaría con otro adaptador de `SyncPort`; los servicios
  locales no cambian.
