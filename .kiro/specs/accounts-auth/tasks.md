# Tareas · N1 Cuentas e inicio de sesión

## Fase 1 · Supabase y microservicio

- [x] 1. Configuración de Supabase Auth: Google, código por email, redirección y duración, documentada
      en `services/cloud/README.md`.
- [x] 2. Guarda del microservicio que valida el token de Supabase, con pruebas de token caducado y
      de otro proyecto.
- [x] 3. Tablas `profiles` y `devices` con RLS; `UpdateProfile`, `RegisterDevice` y `ListDevices`.
- [x] 4. `DeleteAccount` con la regla de organizaciones.

## Fase 2 · App

- [x] 5. Protocolo `daylios://` y supabase-js con flujo PKCE; alternativa de callback en `127.0.0.1`.
- [x] 6. `cloud/auth.ts` con almacenamiento de sesión en el Llavero vía `safeStorage`, renovación y
      `onAuthChanged`.
- [x] 7. IPC y preload solo con `{ user, status }`; tipos en `src/shared/account.ts`.

## Fase 3 · Interfaz

- [x] 8. Ajustes, «Cuenta y equipo»: sin sesión, esperando y con sesión.
- [x] 9. Lista de dispositivos y cierres de sesión.
- [x] 10. Iniciales y menú de cuenta en la franja.

## Fase 4 · Cierre

- [x] 11. Autor en los cambios hechos con sesión, también desde MCP.
- [x] 12. Revisión estática y de seguridad; README.

## Checklist

- [ ] Sin cuenta la app funciona igual que antes
- [ ] Inicio sesión con Google y vuelvo a la app sola, con mi nombre en la franja
- [ ] Reinicio la app y sigo con sesión; en el Llavero aparece la entrada de DayliOS
- [ ] Cierro sesión en todos y el otro dispositivo pide volver a entrar
- [ ] Cierro el navegador a mitad y la app no queda colgada

## Notas de la implementación

- Google abre el navegador del sistema con PKCE. El código por email se pide y se escribe dentro de
  la app: Supabase no trae una página de acceso propia y así no hace falta salir de DayliOS.
- La sesión se cifra con `safeStorage`, cuya clave vive en el Llavero, y se guarda en
  `session.bin` con permisos 600. Sin cifrado disponible solo vive en memoria.
- Callback: `daylios://auth/callback` en la app empaquetada y `http://127.0.0.1:47615/auth/callback`
  en desarrollo. Solo se acepta un código mientras hay un inicio de sesión en curso, y una vez.
- Iniciar sesión activa la edición Equipo y cerrar sesión vuelve a Local. Una sesión caducada deja
  la app en local con el aviso «Volver a entrar».
- Autor de los cambios: columna `by` en `change_log`, llenada por los triggers con la función
  `daylios_author()`. Así también firman las escrituras de Claude por MCP.
- Dependencia nueva en la app: `@supabase/supabase-js` 2.117.3. Hay que correr `npm install`.
- Pruebas escritas sin ejecutar, en `src/test`: `cloud-account`, `cloud-token-verifier`,
  `account-session` y `change-log-author`.
