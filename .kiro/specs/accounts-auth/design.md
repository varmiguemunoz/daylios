# Diseño · N1 Cuentas e inicio de sesión

## 1 · Flujo desde la app de escritorio

```
App, main               Navegador                   Supabase Auth
 │ supabase-js con flujo PKCE
 │── abre la URL de acceso de Supabase ──▶ │
 │                                         │── Google o código por email ──▶ │
 │                                         │◀── redirige a daylios://auth/callback?code
 │◀── deep link ───────────────────────────│
 │── exchangeCodeForSession(code) ──────────────────────────────────────▶ │
 │◀── { access, refresh, user } ──────────────────────────────────────── │
 │ guarda la sesión en el Llavero con safeStorage, como almacenamiento de supabase-js
 │── llama a services/cloud con el token de acceso; el servicio lo valida
```

- Protocolo propio `daylios://` registrado con `app.setAsDefaultProtocolClient`; un solo
  manejador valida `state` y descarta lo demás.
- Main tiene `cloud/auth.ts` con `AuthService`: `signIn`, `signOut`, `signOutEverywhere`,
  `session`, `accessToken` con renovación y el evento `onAuthChanged`. Implementa `IdentityPort`.
- El renderer nunca ve los tokens. Solo recibe `{ user, status }`.

## 2 · Supabase y microservicio

- **Supabase Auth** guarda usuarios, identidades y sesiones, rota los tokens de renovación y envía
  el código por email. Se configuran Google, el código por email, la URL de redirección
  `daylios://auth/callback` y la duración de la sesión.
- **`services/cloud`** no emite tokens. Su guarda valida el token de Supabase con su clave pública y
  saca el usuario. Tablas propias: `profiles` con nombre e iniciales y `devices` con nombre y
  última actividad.
- **Casos de uso del servicio:** `UpdateProfile`, `RegisterDevice`, `ListDevices`, `DeleteAccount`
  con la regla de organizaciones, que usa la API de administración de Supabase desde el servidor.

## 3 · Interfaz

Ajustes, «Cuenta y equipo»:

- Sin sesión: qué incluye la edición Equipo y «Iniciar sesión o crear cuenta».
- Esperando al navegador: estado con «Cancelar».
- Con sesión: tarjeta con iniciales, nombre editable y email; lista de dispositivos; «Cerrar
  sesión» y «Cerrar sesión en todos».
- La franja superior muestra las iniciales a la derecha, con menú de cuenta.

## 4 · Riesgos

- El deep link no llega si la app no está registrada como manejador en desarrollo. Alternativa:
  servidor local de un solo uso en `127.0.0.1` para el callback.
- Borrar una cuenta que es dueña de organizaciones: se exige transferir o borrar antes.
