# daylios-cloud

Microservicio de la edición Equipo de DayliOS. NestJS con arquitectura hexagonal sobre Supabase
PostgreSQL, Auth y Realtime. Decisiones en `.kiro/specs/cloud-foundations/adr`.

## Capas

- `src/domain`: reglas puras, sin NestJS ni base de datos. Roles, permisos y validación de
  mutaciones. Sus pruebas están en `src/test/cloud-domain.test.ts` y corren desde la raíz con `npm test`.
- `src/application`: casos de uso. Hoy `GetEntitlements`; N2 y N3 añaden invitaciones, push y pull.
- `src/ports`: interfaces que usan los casos de uso.
- `src/adapters`: HTTP con NestJS, PostgreSQL con `pg` y Supabase con `jose`.
- `src/app.module.ts` y `src/main.ts`: lo único atado a NestJS.
- Contratos compartidos con la app en `src/shared/sync-protocol.ts`, `sync-merge.ts`, `hlc.ts` y
  `edition.ts`.

## Puesta en marcha

1. Proyecto de Supabase en `us-west-1`.
2. Aplicar las migraciones de `supabase/migrations` en orden.
3. Crear el rol `daylios_service` con contraseña y `grant authenticated to daylios_service`.
4. Copiar `.env.example` a `.env` con `SUPABASE_URL`, `DATABASE_URL` del rol anterior y
   `SUPABASE_SERVICE_ROLE_KEY`. Esa clave solo vive en el servidor.
5. `npm install`, `npm run build` y `npm start`. `GET /health` responde la versión del protocolo.

## Supabase Auth, N1

En el panel de Supabase, Authentication:

1. **Providers**: Google activado con su cliente OAuth. Email activado, sin contraseña.
2. **Email templates**, Magic Link: incluir el código `{{ .Token }}`. La app pide el código de
   6 dígitos, así no hace falta salir de ella.
3. **URL Configuration**, Redirect URLs: `daylios://auth/callback` para la app empaquetada y
   `http://127.0.0.1:47615/auth/callback` para desarrollo.
4. **Sessions**: token de acceso de 3600 s y rotación del token de renovación activada, con 10 s de
   margen de reutilización.
5. **Rate limits**: un email por dirección cada 60 s y 30 por hora en el proyecto. La app también
   espera 60 s antes de dejar pedir otro código.
6. Flujo PKCE en la app: el código de Google solo se canjea una vez y solo mientras hay un inicio
   de sesión en curso.

En la app, `.env` de la raíz del repositorio con `MAIN_VITE_SUPABASE_URL`,
`MAIN_VITE_SUPABASE_ANON_KEY` y `MAIN_VITE_CLOUD_URL`. La clave anónima es pública por diseño; la de
servicio nunca va en la app.

## Organizaciones, N2

Variables nuevas: `PUBLIC_URL` con la URL pública del servicio, y opcionales `RESEND_API_KEY`,
`MAIL_FROM` y `DOWNLOAD_URL`. Los planes viven en la tabla `plans`; para cambiar el límite de una
organización basta con cambiar su `plan`.

## Sincronización, N3

Aplicar `0004_sync.sql`. Activa la política de Realtime para que solo los miembros escuchen el
canal `org:<id>`. En Realtime, Settings, desactivar «Allow public access» para que los canales
privados exijan sesión.

Para probar en local con dos copias de la app: levantar este servicio con `npm run dev` y
`npm start`, poner `MAIN_VITE_CLOUD_URL=http://127.0.0.1:8787` en el `.env` de la app y abrir dos
usuarios de macOS o dos Macs con cuentas distintas en la misma organización.

## Archivos, N4

Aplicar `0005_files.sql`. Crear un bucket privado en Cloudflare R2 y un token de API con lectura y
escritura solo sobre ese bucket; poner `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` y
`S3_SECRET_ACCESS_KEY`. En CORS del bucket permitir `PUT` y `GET` y exponer la cabecera `ETag`.
`FILE_MAX_MB` limita el tamaño de un archivo, 200 por defecto. El espacio por organización viene de
`plans.max_storage_bytes`.

La limpieza corre con un cron diario que llama `POST /internal/purge` con la cabecera
`x-cron-secret` igual a `CRON_SECRET`. Borra los objetos que ningún archivo usa después de 7 días y
los que llevan 30 días en la papelera. Para medir la subida y bajada de 1 000 archivos:
`npm run bench:storage`.

## Equipo en tiempo real, N5

Aplicar `0006_team.sql`. Crea la tabla `activity`, la política para que solo los miembros
publiquen presencia en el canal `org:<id>:presence` y un trigger que pasa invitaciones y altas de
`audit_log` a la actividad. La actividad se deduce en `push` de los cambios que llegan; la siembra
inicial viaja con `quiet` y no genera entradas. Varias ediciones del mismo registro por la misma
persona en un minuto se juntan en una entrada con su cuenta.

## Despliegue

Contenedor según ADR-06. Desde la raíz del repositorio:
`docker build -f services/cloud/Dockerfile -t daylios-cloud .`

## Rutas

| Ruta                                  | Acceso            | Qué hace                                                                                        |
| ------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `GET /health`                         | público           | Salud y versión del protocolo                                                                   |
| `GET /orgs/:orgId/entitlements`       | token de Supabase | Funciones de equipo de la persona en esa organización                                           |
| `GET /me` y `PATCH /me`               | token             | Perfil propio con iniciales; cambiar el nombre                                                  |
| `GET /me/devices`                     | token             | Dispositivos con sesión, el más reciente primero                                                |
| `PUT /me/devices/:id`                 | token             | Alta o latido del dispositivo                                                                   |
| `DELETE /me/devices?keep=:id`         | token             | Olvida los demás antes de cerrar sesión en todos                                                |
| `DELETE /me`                          | token             | Borra la cuenta con `{ confirm: "BORRAR" }`; 409 si es dueña de organizaciones con más miembros |
| `POST /files/:orgId/uploads`          | token, escritura  | Pide subir un contenido por hash; responde si ya existe, una URL o las partes                   |
| `POST /files/:orgId/uploads/parts`    | token, escritura  | Nuevas URLs para partes pendientes al reanudar                                                  |
| `POST /files/:orgId/uploads/complete` | token, escritura  | Cierra la subida y verifica el tamaño                                                           |
| `GET /files/:orgId/blobs/:hash`       | token             | URL firmada de descarga por 10 minutos                                                          |
| `GET /files/:orgId/usage`             | token             | Espacio usado y límite del plan                                                                 |
| `POST /internal/purge`                | `x-cron-secret`   | Limpieza de objetos sin uso y de la papelera                                                    |
| `GET /activity/:orgId?since=`         | token             | Actividad de la organización desde un cursor, en páginas de 500                                 |
