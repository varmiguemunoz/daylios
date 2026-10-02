# Tareas

## Fase A · Arreglo de «Grabar»
- [x] A1. `consultora-window.ts`: handler con try/catch, siempre llama a `callback` (causa del cuelgue)
- [x] A2. IPC `recording:check` (estado de pantalla y micro) + `askForMediaAccess('microphone')`; `app:relaunch`
- [x] A3. `recorder.ts`: `acquire()` con timeout de 15 s y `record()`; `Recorder.tsx`: check → acquire → start → record
- [x] A4. Panel de permisos en la barra superior: qué falta + «Abrir Ajustes del Sistema» + «Reiniciar DayliOS»
- [x] A5. `recoverInterrupted()`: borrar reuniones `recording` vacías (fila + archivo)
- [x] A6. `Meeting.tsx`: «Esta reunión ya no existe» si se borró
- [x] A7. `install.sh`: firmar con certificado del llavero (detección automática, `DAYLIOS_SIGN_IDENTITY` para forzar); aviso si solo hay ad-hoc

## Fase B · Notas de voz
- [x] B1. Dependencia `uiohook-napi`; `voice/shortcut.ts` (globalShortcut + soltar con uiohook; modo alternar)
- [x] B2. `voice/voice-window.ts` + renderer `?window=voice`: pastilla + MediaRecorder del micro
- [x] B3. `ai.service.formatNote()`; `services/voice-note.service.ts` (transcribir → formatear → crear nota → borrar audio; pendientes)
- [x] B4. Notificación con clic → popover abre la nota (`notes:open`)
- [x] B5. Ajustes: atajo, activado, Monitorización de entrada, pendientes + Reintentar; guardado en settings.json
- [x] B6. Pastilla según DESIGN.md (sin revisión visual: la app no corre aquí)
- [x] B7. README (atajo, permisos) y DESIGN.md (pastilla de voz)

## Fase C · Verificación (dueño)
- [ ] C1. `npm install`, `typecheck`, `lint`, `service:install` (verás qué firma usa)
- [ ] C2. Conceder Grabación de pantalla, Micrófono y Monitorización de entrada → «Reiniciar DayliOS»
- [ ] C3. Grabar 1 min de reunión → reinstalar → grabar otra vez sin que pida permisos
- [ ] C4. Desde otra app: mantener ⌥ Espacio, dictar «recordar llamar a Juan Felipe el lunes…», soltar → nota en Notas
