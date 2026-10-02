# Tareas

## Fase 0 · Pruebas de riesgo

- [ ] 0.1 Primera grabación de prueba (2 min): confirmar que se oye tu voz y la del otro lado. Si sale el aviso «Sin audio del sistema», plan B: BlackHole
- [ ] 0.2 Confirmar permisos: micrófono, grabación de pantalla, Escritorio, con la app instalada por `service:install`

## Fase 1 · Base y configuración (M1, M2, M5, M7)

- [x] 1. `src/main/config.ts`: ajustes en settings.json, editables desde la ventana (sin `.env`)
- [x] 2. `src/shared/consultora.ts`: tipos, estados, contratos, `normalizeName()`
- [x] 3. Modelos + migración `CreateConsultora` (con etapas por defecto)
- [x] 4. `client.service` (carpeta al crear), `project.service`, `prospect.service` con etapas (ganada → cliente)
- [x] 5. `services/documents.ts` (listar / leer texto, sin salir de la carpeta del cliente)
- [x] 6. `meeting.service` (CRUD, action items, asociación por título), `context.service` (overview, búsqueda, notas fechadas)
- [x] 7. Controladores, vistas y rutas `/consultora/*`; IPC `consultora:*`; preload `window.api.consultora`

## Fase 2 · Ventana Consultora (UI)

- [x] 8. `consultora-window.ts`, entrada en menú del menubar, renderer con `?window=consultora`
- [x] 9. Layout: barra lateral + barra superior (Grabar, buscar). Dirección visual con impeccable
- [x] 10. Clientes + ficha de cliente (documentos incluidos)
- [x] 11. Proyecto (entregables marcables)
- [x] 12. Pipeline (tablero) + prospecto
- [x] 13. Reuniones (lista por día) + detalle + reunión manual
- [x] 14. Ajustes (ruta, API key, etapas)

## Fase 3 · Grabación y AI (M4)

- [x] 15. Captura: `setDisplayMediaRequestHandler`, mezcla de audio, `MediaRecorder`, trozos a disco, indicador + menubar
- [x] 16. Diálogo al detener: título, participantes, asociación sugerida
- [x] 17. `ffmpeg-static`: extraer audio y partir en 10 min
- [x] 18. `ai.service`: transcribir trozos + resumen estructurado (map → reduce si es largo)
- [x] 19. Pipeline con estados, reintento, notificación, mover grabación a la carpeta del cliente
- [x] 20. Permisos y entitlements en `electron-builder.yml` / `build/entitlements.mac.plist`

## Fase 4 · Claude y docs (M6)

- [x] 21. 20 herramientas MCP con descripciones orientadas a preguntas
- [x] 22. README (configuración `.env`, permisos, herramientas) y PRODUCT.md (alcance nuevo)

## Fase 5 · Verificación (dueño)

- [ ] 23. `npm install`, `typecheck`, `lint`, `service:install`
- [ ] 24. Flujo real: cliente → carpeta; prospecto → ganado → cliente; grabar 2 min → resumen; preguntar a Claude las 5 preguntas del requisito

## Siguiente iteración

- [ ] Ajuste para borrar el video tras transcribir (ahorra espacio)
- [ ] Action items de «Miguel» como tareas de Hoy
- [ ] Arrastrar tarjetas en el pipeline
