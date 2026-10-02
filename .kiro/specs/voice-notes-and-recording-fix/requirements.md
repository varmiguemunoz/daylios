# Requisitos · Arreglo de «Grabar» + notas de voz

## Contexto
1. **Bug:** al pulsar «Grabar reunión» macOS vuelve a pedir permisos, el botón se queda en «Preparando…» para siempre
   y aparece una reunión rota (archivo `.webm` de 0 bytes en `_reuniones/`).
2. **Feature:** dictar una nota. Mantener pulsado un atajo global, hablar, soltar; el agente transcribe y
   escribe la nota en markdown en Notas de DayliOS.

## Diagnóstico (evidencia)
- `~/Library/Logs/daylios.log`: `UnhandledPromiseRejectionWarning: Failed to get sources.` (dos veces).
  Viene de `desktopCapturer.getSources()` dentro de `setDisplayMediaRequestHandler`: falla, nadie lo captura
  y **nunca se llama a `callback`**, así que `getDisplayMedia()` en la ventana espera para siempre.
- `getSources` falla porque macOS no da permiso de Grabación de pantalla al binario que corre.
  Una grabación funcionó (`Dave Nelson/Reuniones/2026-10-02 1144.webm`, 1,6 MB). Las siguientes, después de
  reinstalar, fallaron: `install.sh` firma con **firma ad-hoc** (`codesign --sign -`), que cambia en cada build.
  macOS guarda el permiso ligado a esa firma: la entrada «daily-os» sigue marcada en Ajustes, pero ya no corresponde
  al binario nuevo, y macOS vuelve a preguntar. Además, macOS exige **reiniciar la app** después de conceder
  Grabación de pantalla.
- La reunión rota aparece porque `recording.start()` crea la fila y el archivo **antes** de tener la captura.
- 4 archivos de 0 bytes en `_reuniones/` (11:43, 12:03, 12:04, 12:13) = 4 intentos fallidos.
- `No existe esa reunión` en el log: la pantalla de una reunión borrada se recarga con `data:changed`. Solo ruido.

## A · Arreglo de grabación
- A1 Si falta un permiso, «Grabar» no se queda colgado: muestra qué permiso falta, con botones
  «Abrir Ajustes del Sistema» y «Reiniciar DayliOS».
- A2 La reunión y su archivo se crean **solo** cuando ya hay pantalla y audio capturándose.
- A3 Ningún paso de la captura espera más de 15 s; si se pasa, error claro.
- A4 Al arrancar, las reuniones `recording` con archivo vacío o inexistente se borran (fila y archivo).
  Con contenido, quedan en error con «Reintentar», como hasta ahora.
- A5 Firma estable: el permiso concedido debe sobrevivir a `service:install`. Se firma con un certificado
  del llavero (Apple Development / Developer ID, que ya existe si usas Xcode). Si no hay ninguno, se avisa al instalar.
- A6 La pantalla de una reunión borrada muestra «Esta reunión ya no existe» en vez de reintentar.

## B · Notas de voz
- B1 Atajo global **⌥ Espacio**, en cualquier app, aunque DayliOS esté oculta. Configurable en Ajustes.
- B2 Mantener pulsado = grabar; soltar = terminar. Sin permiso de Monitorización de entrada:
  modo alternativo (pulsar para empezar, pulsar otra vez para terminar).
- B3 Mientras graba: una pastilla flotante arriba en el centro («● Escuchando 0:07»), sin robar el foco.
  Luego «Escribiendo la nota…» y «✓ Nota creada».
- B4 Solo micrófono. Grabaciones de menos de 1 s se ignoran (pulsación accidental). Máximo 10 min.
- B5 Al terminar: transcribir (Whisper) → el modelo escribe la nota en markdown (primera línea `# Título`,
  listas, casillas `- [ ]` para tareas que mencione, mismo idioma, sin inventar) → se guarda en **Notas de DayliOS**.
- B6 Notificación «Nota creada: <título>». Clic: abre el popover en esa nota.
- B7 Si falla el formato pero hay transcripción, se guarda la transcripción tal cual (no se pierde lo dicho).
  Si falla la transcripción, el audio se guarda y Ajustes ofrece «Reintentar».
- B8 Al terminar bien, el audio se borra.
- B9 Claude ya las lee con `list_notes` / `get_note` (sin cambios en el MCP).

## Fuera de alcance
Asociar la nota a un cliente, dictar dentro de una nota existente, otros atajos para otras acciones.
