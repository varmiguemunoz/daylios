# Tareas · Alisuite para macOS y Windows

S pequeña, M media, L grande. P0 imprescindible, P1 importante. Cada tarea termina con
`npm run check` sin errores.

## Fase A · Identidad sin perder datos

- [x] A1 `DATA_DIR` compartido; `userData` fijo antes de `ready`; `mcp/client.ts` lo usa. S · P0 · R2.1,
  R2.3
- [x] A2 `appId`, `productName` y textos visibles a Alisuite; `setAppUserModelId`. S · P0 · R1.1, R3.8 ·
  tras A1
- [x] A3 Script de iconos y PNG versionados: app, bandeja macOS y bandeja Windows. S · P0 · R1.2, R1.3
- [ ] A4 Probar en tu Mac que Alisuite abre con todos tus datos. S · P0 · tras A1 y A2

## Fase B · Plataforma

- [x] B1 `platform.ts` y guardas en permisos, atajo de voz y voz. S · P0
- [x] B2 `handleProtocolUrl` para `open-url`, `second-instance` y argv inicial, con pruebas. S · P0 ·
  R3.7
- [x] B3 Ventana Consultora con `titleBarOverlay`; `platform` en preload; padding de `AppShell`. M · P0 ·
  R3.3
- [x] B4 Sin menú en Windows. S · P0 · R3.4
- [x] B5 Ventana compacta encima de la bandeja si está abajo; icono de bandeja por plataforma. S · P0 ·
  R3.2
- [x] B6 `shared/keys.ts`, componente `Shortcut` y sustitución en los 16 archivos. M · P1 · R3.5
- [x] B7 Atajo de voz por defecto en Windows. S · P1 · R3.6
- [x] B8 Carpeta de documentos por defecto con `app.getPath('desktop')`. S · P1 · R3.11
- [x] B9 Inode `bigint` en `vault.scan` y `local-files.ts`, con prueba. S · P0 · R3.12
- [x] B10 Abrir al iniciar sesión con interruptor en Ajustes. S · P1 · R3.10

## Fase C · Claude y actualizaciones

- [x] C1 `claude-config.ts` y botón Conectar con Claude, con pruebas. M · P1 · R6.1 · tras A1
- [x] C2 `electron-updater`, `updater.ts`, versión y Buscar actualizaciones en Ajustes. M · P0 · R5.2,
  R5.3 · tras P2

## Fase D · Construcción y publicación

- [x] D1 `electron-builder.yml` con `win`, `nsis`, `mac` y `publish`; scripts `build:win` y `release`.
  S · P0 · R3.1, R4.2
- [x] D2 Workflow de CI: check y pruebas en macOS y Windows en cada push. S · P0 · R7.1
- [ ] D3 Corregir lo que falle en la suite de Windows. M · P0 · tras D2
- [x] D4 Workflow de release con tag `v*`. S · P0 · R5.1 · tras D1, D3 y P2
- [x] D5 Firma y notarización en macOS si P1 se aprueba. M · P1 · tras P1

## Notas de implementación

- macOS se construye en un solo job con `--x64 --arm64` para que `latest-mac.yml` incluya las dos
  arquitecturas. `build/after-pack.cjs` cambia ffmpeg por el binario Intel que baja
  `scripts/ffmpeg-x64.mjs`.
- Release en tres pasos: borrador, construcción en macOS y Windows, publicación. La app nunca ve una
  versión a medias.
- Secretos en GitHub: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`,
  `APPLE_TEAM_ID`. Variables: `MAIN_VITE_SUPABASE_URL`, `MAIN_VITE_SUPABASE_ANON_KEY`,
  `MAIN_VITE_CLOUD_URL`.
- `.gitattributes` fuerza LF para que el lint pase en Windows.
- `scripts/install.sh` marca `login-item` para no duplicar el arranque con launchd.

## Fase E · Validación

- [ ] E1 Checklist manual en Windows y en un Mac del equipo. S · P0
- [ ] E2 Guía corta de instalación para el equipo, con SmartScreen y Gatekeeper. S · P1

## Checklist Windows

- [ ] Instalo `Alisuite-Setup` sin administrador y aparece el acceso en el escritorio
- [ ] Alisuite arranca en la bandeja; al hacer clic la ventana sale encima de la barra de tareas
- [ ] La ventana Consultora se minimiza, maximiza, cierra y se arrastra por la cabecera
- [ ] No hay barra de menú
- [ ] Los atajos dicen Ctrl
- [ ] Inicio sesión con mi cuenta y vuelvo a la app
- [ ] Llega una notificación
- [ ] Grabo una reunión con micrófono y audio del sistema y se transcribe
- [ ] Creo un cliente, una nota y un board, y subo un PDF que se ve en el board
- [ ] Me uno a la organización y se sincronizan datos y archivos
- [ ] Conectar con Claude deja el MCP funcionando
- [ ] Reinicio Windows y Alisuite se abre sola
- [ ] Publico una versión nueva y la app se actualiza
