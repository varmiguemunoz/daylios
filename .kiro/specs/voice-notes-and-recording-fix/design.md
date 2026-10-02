# Diseño · Arreglo de «Grabar» + notas de voz

## A · Arreglo de grabación

### A1 · Permisos antes de capturar
```
Renderer «Grabar» ─► recording:check ─► main: systemPreferences.getMediaAccessStatus('screen' | 'microphone')
   ├─ todo 'granted' ─► sigue
   └─ falta algo     ─► panel: «Falta permiso de Grabación de pantalla»
                          [Abrir Ajustes del Sistema] → x-apple.systempreferences:…Privacy_ScreenCapture
                          [Reiniciar DayliOS]         → app.relaunch() + app.exit()
```
- Micrófono `not-determined`: `systemPreferences.askForMediaAccess('microphone')` (muestra el diálogo de macOS).
- Pantalla: macOS no tiene «preguntar» por API; el primer intento lo dispara. Tras concederlo hay que reiniciar
  la app: por eso el botón.

### A2 · Orden nuevo de la captura
```
antes:  crear reunión + archivo ─► getDisplayMedia (se cuelga) ─► …       ← reunión rota
ahora:  check ─► getDisplayMedia + getUserMedia (con timeout 15 s) ─► crear reunión + archivo ─► MediaRecorder.start
```
`recorder.ts` se parte en dos: `acquire()` (pide pantalla y micro, devuelve las pistas) y `record(streams, onChunk)`.

### A3 · El handler de main siempre responde
```ts
setDisplayMediaRequestHandler(async (_req, callback) => {
  try {
    const [screen] = await desktopCapturer.getSources({ types: ['screen'] })
    callback(screen ? { video: screen, audio: 'loopback' } : {})
  } catch {
    callback({})   // getDisplayMedia rechaza al momento en vez de colgarse
  }
})
```

### A4 · Limpieza al arrancar
`recoverInterrupted()`: filas `recording` → archivo con 0 bytes o sin archivo: borrar fila y archivo;
con datos: `error` + «Reintentar». Limpia los 4 intentos rotos actuales.

### A5 · Firma estable (`scripts/install.sh`)
```
IDENTITY = $DAYLIOS_SIGN_IDENTITY
        || primera de `security find-identity -v -p codesigning` que sea «Developer ID Application» o «Apple Development»
si hay IDENTITY: codesign --force --deep --options runtime --entitlements build/entitlements.mac.plist --sign "$IDENTITY"
si no:           firma ad-hoc (como ahora) + aviso: «los permisos se pedirán de nuevo tras cada instalación»
```
Con un certificado real, el «requisito de firma» que guarda macOS es el mismo en cada build: el permiso se conserva.
La primera vez con la firma nueva macOS pedirá los permisos **una última vez**.

Entitlements (hardened runtime): `audio-input` (ya está), `allow-jit` y `allow-unsigned-executable-memory` (ya están, Electron los necesita).

## B · Notas de voz

### Piezas
```
main
  voice/shortcut.ts      atajo global: pulsar (globalShortcut) + soltar (uiohook-napi)
  voice/voice-window.ts  ventana pastilla: transparente, siempre encima, sin foco, en todos los escritorios
  services/voice-note.service.ts   audio → transcribir → formatear → NoteService.create
  services/ai.service.ts           + formatNote(transcript): markdown
renderer
  voice/VoicePill.tsx    la pastilla + MediaRecorder del micro (?window=voice)
```

### Detectar «mantener pulsado» en cualquier app
macOS no da «soltar tecla» a los atajos globales de Electron. Se combinan dos cosas:
- **Pulsar:** `globalShortcut.register('Alt+Space')`. Además de avisar, *se come* la tecla: no se escribe un espacio en la app de delante.
- **Soltar:** `uiohook-napi` (escucha el teclado del sistema, solo lectura). Al soltar Espacio **o** ⌥ → parar.
  Es N-API: funciona con Electron sin recompilar. Necesita **Monitorización de entrada** (Ajustes del Sistema).
- Sin ese permiso (o si uiohook no carga): modo alternar. Pulsar empieza, pulsar otra vez termina. La pastilla lo indica.
- La repetición automática de la tecla se ignora (bandera `recording`).

### Flujo
```
⌥Espacio ↓ ─► main: mostrar pastilla (showInactive) ─► voice:start ─► renderer: getUserMedia + MediaRecorder (opus)
⌥Espacio ↑ ─► main ─► voice:stop ─► renderer: Blob (WebM/Opus, ~0,2 MB/min) ─► voice:finish(bytes, segundos)
main: < 1 s → descartar
      escribir temporal ─► ai.transcribe([archivo]) (Whisper acepta WebM, sin ffmpeg)
      ─► ai.formatNote(texto) ─► notes.create(markdown) ─► notify() ─► Notification «Nota creada: …»
      ─► borrar audio
pastilla: Escuchando 0:07 → Escribiendo la nota… → ✓ Nota creada (1,5 s) → se oculta
```
- Fallo en `formatNote`: nota con la transcripción tal cual, con «## Nota de voz (sin formato)».
- Fallo en `transcribe`: audio a `<userData>/voice-pending/`; Ajustes → «Notas de voz pendientes (n) · Reintentar».
- Clic en la notificación: abre el popover en Notas con esa nota (evento `notes:open` → App abre el editor).

### Prompt de `formatNote` (resumen)
«Convierte este dictado en una nota markdown. Primera línea `# Título` corto. Ordena en párrafos, listas o
casillas `- [ ]` cuando haya tareas. Mismo idioma del dictado. Quita muletillas. No añadas nada que no se haya dicho.»
Salida: texto markdown (sin JSON). Modelo: el de resumen de Ajustes.

### Ajustes nuevos
- Atajo de nota de voz (por defecto ⌥ Espacio) y «Activado».
- Estado de Monitorización de entrada + botón «Abrir Ajustes del Sistema».
- Notas de voz pendientes · Reintentar.

## Diseño visual (impeccable al construir)
Pastilla: superficie elevada, pill, 44 px de alto, sombra «toast float» (la única sombra del sistema).
Punto rose (en vivo) + cronómetro tabular; «Escribiendo la nota…» en apricot; «✓» en mint. Sin otros colores.

## Riesgos
| Riesgo | Plan |
|---|---|
| ⌥ Espacio ya lo usa otra app (p. ej. ChatGPT) | `register` devuelve false → aviso en Ajustes y elegir otro atajo |
| uiohook no recibe «soltar Espacio» tras comerse la tecla | También se para al soltar ⌥; si no, modo alternar |
| Sin certificado de firma | Aviso en la instalación; permisos se repiten tras cada `service:install` |
| Pastilla tapa algo en pantalla completa | 44 px, arriba al centro, `visibleOnFullScreen` |
