# ADR-03 · Identidad

- Estado: aprobado
- Fecha: 13 oct 2026
- Módulo: N1

## Decisión

Supabase Auth, con Google y código por email. Flujo PKCE desde la app de escritorio con el
navegador del sistema y el deep link `daylios://auth/callback`. La sesión se guarda en el Llavero
de macOS con `safeStorage`. El microservicio valida el token de Supabase en cada petición y nunca
emite tokens propios.

## Pendiente de fijar al construir N1

Duración del token de acceso, política de cierre de sesión en todos los dispositivos y plantilla
del email en español.
