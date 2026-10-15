# Diseño · N3 Sincronización de datos en la nube

Diseño para la recomendación de ADR-02, registro de cambios propio en `services/cloud` sobre
Supabase. Si el ADR elige PowerSync, se reescribe este documento antes de empezar.

## 1 · Protocolo

En `src/shared/sync-protocol.ts`:

- **Mutación:** `{ mutationId, entity, entityId, op, fields, rev, baseRev }`.
- **Empuje:** `POST /sync/push { orgId, mutations[] }` responde `{ applied, rejected[], cursor }`.
- **Recepción:** `GET /sync/pull?cursor` responde `{ changes[], cursor, hasMore }`.
- **Aviso:** canal de Supabase Realtime por organización, `org:<orgId>`, con un mensaje de difusión
  `{ cursor }` cuando hay cambios nuevos; el cliente hace `pull` al microservicio. El canal solo
  avisa, los datos van por HTTP, así es simple y fácil de reintentar.

## 2 · Cliente, en `src/main/cloud/sync/`

- **`SyncEngine`:** lee `change_log` desde el último enviado, agrupa cada 300 ms, empuja, marca lo
  aceptado y guarda el cursor. Reintentos con espera creciente.
- **`ChangeApplier`:** aplica cambios remotos dentro de `transactionGuard` sin escribir en
  `change_log`, compara `rev` por campo y emite `data-changed` con las entidades tocadas, así
  las pantallas se refrescan con el mecanismo que ya existe.
- **Reloj:** reloj lógico híbrido por dispositivo en `cloud/hlc.ts`, con pruebas.
- **Orden:** las posiciones de tareas, prospectos y etapas pasan a índices fraccionarios en texto
  para que dos reordenamientos no choquen.
- **Arranque inicial:** descarga paginada por entidad con progreso; mientras, la app usa lo ya
  descargado.

## 3 · Servidor

- **Tablas:** una por entidad con las mismas columnas más `org_id` obligatorio y `server_seq`;
  `mutations` con `mutation_id` único para no aplicar dos veces.
- **Casos de uso:** `PushMutations` valida permisos, aplica último en guardar gana por campo y
  registra en la actividad de N5; `PullChanges` devuelve por `server_seq`; `Bootstrap`.
- **Tiempo real:** al aplicar, el microservicio publica el nuevo cursor en el canal de la
  organización con el adaptador `Realtime` de Supabase. Funciona igual con varias instancias.

## 4 · Interfaz

- **Indicador** en la franja junto a la grabación: icono de nube con su estado y un panel con el
  detalle.
- **Asistente** al crear o unirse a una organización: elegir datos, resumen, progreso.
- **Edición en curso:** si llega un cambio remoto al campo que se está editando, el campo conserva el
  borrador y muestra «Ana cambió esto», con «Ver su versión».

## 5 · Riesgos

- Un registro con muchos cambios seguidos, como escribir notas largas: el registro guarda el campo
  completo, no cada tecla, y el empuje agrupa.
- Migraciones del esquema con dispositivos en versiones distintas: el protocolo lleva versión y el
  servidor rechaza clientes demasiado viejos con un mensaje para actualizar.
