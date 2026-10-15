# Requisitos · N1 Cuentas e inicio de sesión

## Contexto

Para trabajar en equipo hace falta saber quién es cada persona. La app hoy no tiene cuentas. La
cuenta es la base de organizaciones, sincronización y actividad. Decisión del dueño: Supabase Auth.

## R1 · Sin cuenta sigue todo igual

- R1.1 La edición Local no pide cuenta nunca.
- R1.2 Iniciar sesión no sube datos. Subir datos es un paso aparte, en N3.

## R2 · Crear cuenta e iniciar sesión

- R2.1 Desde Ajustes, «Cuenta y equipo», botón «Iniciar sesión o crear cuenta».
- R2.2 Se abre el navegador del sistema con la página de acceso. Métodos: Google y enlace o código
  por email.
- R2.3 Al terminar, el navegador devuelve a la app y la app muestra la cuenta sin pegar nada.
- R2.4 Si se cierra el navegador sin terminar, la app vuelve a su estado anterior con un aviso
  amable.

## R3 · Sesión

- R3.1 La sesión se guarda en el Llavero de macOS, nunca en texto plano ni en `settings.json`.
- R3.2 La sesión se renueva sola. Si caduca, la app sigue funcionando en local y pide volver a
  entrar sin perder nada.
- R3.3 «Cerrar sesión» borra la sesión del dispositivo. «Cerrar sesión en todos los dispositivos»
  invalida las demás.
- R3.4 Lista de dispositivos con sesión abierta, con nombre y última actividad.

## R4 · Perfil

- R4.1 Nombre, email y foto o iniciales. El nombre se usa en la actividad y la presencia.
- R4.2 Borrar la cuenta desde la app, con confirmación escrita. Se explica qué pasa con las
  organizaciones de las que es dueño.

## R5 · Seguridad

- R5.1 Flujo de autorización con PKCE y estado firmado; el código solo se acepta una vez.
- R5.2 Token de acceso de vida corta y token de renovación que rota en cada uso.
- R5.3 Límite de intentos en el envío de códigos por email.
- R5.4 La app nunca muestra ni guarda contraseñas.

## R6 · Claude

- R6.1 Las herramientas MCP siguen actuando en local. Con sesión, sus cambios llevan el usuario como
  autor.
