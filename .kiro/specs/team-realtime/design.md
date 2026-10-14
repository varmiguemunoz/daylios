# Diseño · N5 Actividad del equipo en tiempo real

## 1 · Presencia

- Presencia de Supabase Realtime en el canal `org:<id>:presence`, aparte del de N3. Cada cliente publica
  su estado `{ user, view: { entity, id }, editing: { entity, id, field } }` y Supabase mantiene la
  lista y avisa de entradas y salidas. Nada se guarda en la base.
- `PresencePort` en main con `PresenceService`; el renderer recibe la lista por IPC y la pinta con
  `PresenceStack`, iniciales superpuestas de 20 px.
- El aviso «está editando» sale de escuchar `input` en la pantalla abierta, con espera de 2 s al
  dejar de escribir. Vale para todos los editores sin tocarlos.

## 2 · Actividad

- **Servidor:** tabla `activity` con `org_id`, `actor_id`, `verb`, `entity`, `entity_id`, `title`,
  `detail`, `target_id`, `count`, `seq` y `at`. `describeChange` la deduce en `push` de cada cambio;
  invitaciones y altas llegan desde `audit_log` con un trigger. Se agrupan ráfagas: ediciones del
  mismo registro en un minuto son una entrada y suben `count` y `seq`.
- **Cliente:** se descarga por cursor, como los cambios, y se guarda en una tabla local
  `activity_cache` para verla sin conexión.
- **Interfaz:** organismo `ActivityFeed` en la pestaña nueva de la barra lateral y en las fichas;
  molécula `ActivityItem` con iniciales, frase, tiempo relativo y enlace.

## 3 · Avisos

`Notification` de Electron desde main, con la lista de tipos activos en Ajustes. Al hacer clic se
abre Consultora en el elemento con `openConsultoraAt`.

## 4 · Refresco en vivo

`data-changed` lleva las entidades e ids tocados. Las pantallas que usan `useLoad` se suscriben por
entidad y vuelven a cargar en segundo plano, manteniendo los datos viejos hasta tener los nuevos, así
no hay saltos. Lo resaltado usa una clase con fundido de un segundo, desactivada si se pide reducir
movimiento.

## 5 · Riesgos

- Ruido en la actividad: solo verbos relevantes y agrupación de ráfagas.
- Privacidad de la presencia: se puede ocultar la propia en Ajustes.
