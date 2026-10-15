# Requisitos · Alisuite para macOS y Windows

## Objetivo

Repartir la app al equipo interno como **Alisuite**, con el logo nuevo, instalable en macOS y Windows,
con actualizaciones automáticas y sin perder nada de lo que funciona hoy en macOS.

## Decisiones del usuario, 15 de octubre de 2026

- **D1** Los instaladores se construyen con GitHub Actions en el repo `varmiguemunoz/daylios`.
- **D2** Se reparten por GitHub Releases y la app se actualiza sola.
- **D3** En Windows hay acceso directo en el escritorio. En macOS no.

## Decisiones del usuario, respuestas a P1 a P3

- **P1** Hay cuenta Apple Developer: la app de macOS se firma y se notariza en CI.
- **P2** El repo `varmiguemunoz/daylios` es público: la app lee sus Releases sin token.
- **P3** El equipo usa Mac con Intel: se construye para x64 y arm64.

## R1 · Identidad

- R1.1 Nombre visible Alisuite en macOS y Windows: app, instalador, ventanas, bandeja, menús,
  notificaciones y atajo del escritorio.
- R1.2 Icono de la app a partir del logo entregado, cuadrado y con margen, en `.icns`, `.ico` y `.png`.
- R1.3 Icono de la bandeja: en macOS plantilla monocroma del logo; en Windows el logo a color.

## R2 · Continuidad de datos

- R2.1 Al instalar Alisuite sobre DayliOS en macOS se conservan ajustes, base de datos, sesión,
  organizaciones y carpetas. La carpeta de datos interna sigue llamándose `daily-os`.
- R2.2 Se mantiene el esquema `daylios://` para el inicio de sesión, para no tocar la configuración
  de la nube.
- R2.3 El servidor MCP de Claude sigue funcionando tras el cambio de nombre y de ruta de la app.

## R3 · Windows

- R3.1 Instalador NSIS por usuario, sin permisos de administrador, con accesos en el escritorio y en
  el menú Inicio, y desinstalador.
- R3.2 La app vive en la bandeja del sistema. Clic abre la ventana compacta encima de la barra de
  tareas, sin salirse de la pantalla.
- R3.3 La ventana Consultora tiene botones de minimizar, maximizar y cerrar, y su cabecera se puede
  arrastrar.
- R3.4 Sin barra de menú de Windows en ninguna ventana.
- R3.5 Los atajos se muestran con Ctrl donde macOS muestra ⌘, y ⌥ pasa a Alt.
- R3.6 El atajo de nota de voz por defecto no choca con Alt+Espacio, que en Windows abre el menú de la
  ventana.
- R3.7 Inicio de sesión con `daylios://` funciona: Windows entrega la URL como argumento a la
  instancia abierta.
- R3.8 Las notificaciones se muestran, para lo que Windows exige un AppUserModelId.
- R3.9 Grabación de reuniones con micrófono y audio del sistema, transcripción con ffmpeg.
- R3.10 Opción Abrir al iniciar sesión, activada por defecto, en macOS y Windows.
- R3.11 La carpeta de documentos por defecto usa el Escritorio real de Windows, incluido el de
  OneDrive.
- R3.12 Las rutas, el Workspace, la sincronización de archivos y los boards funcionan con separador
  `\` y nombres no válidos en Windows.

## R4 · macOS

- R4.1 Se mantiene todo lo de hoy: menubar, sin Dock, permisos de micrófono, pantalla y
  accesibilidad.
- R4.2 DMG para instalar y ZIP para la actualización automática, para Intel y Apple Silicon.

## R5 · Distribución y actualización

- R5.1 Un tag `v*` lanza la construcción en macOS y Windows, las pruebas y la publicación en Releases.
- R5.2 La app busca actualizaciones al arrancar y cada 6 horas; descarga en segundo plano y ofrece
  reiniciar.
- R5.3 Ajustes muestra la versión y un botón Buscar actualizaciones.

## R6 · Conectar con Claude

- R6.1 Ajustes tiene Conectar con Claude, que escribe el servidor MCP en la configuración de Claude
  Desktop en macOS y Windows, sin scripts. Sustituye el paso 3 de `scripts/install.sh` para el equipo.

## R7 · Calidad

- R7.1 `npm run check` y `npm test` pasan en macOS y Windows en CI.
- R7.2 Checklist manual en un Windows real antes de la primera versión.

## Fuera de alcance

- Linux.
- Tiendas de apps.
- Certificado de firma de Windows: sin él, SmartScreen avisa en la primera instalación.
