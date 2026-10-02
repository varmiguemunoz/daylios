# Diseño · Consultora

## 1. Vista general

```
Menubar ─ popover DayliOS (Hoy · Historial · Notas)          ← sin cambios
        └ ventana «Consultora» 1100×760, redimensionable      ← nueva, mismo renderer (?window=consultora)
                │ IPC (consultora:*)
                ▼
main ── services: client · project · meeting · prospect · stage · document · recording · ai · config
   │            └ escrituras vía transactionGuard
   ├─ TypeORM ─ SQLite daylios.db (tablas nuevas)
   ├─ fs ────── CLIENTS_DOCS_PATH/<Cliente>/…
   ├─ OpenAI ── transcripción + resumen (solo desde main; la API key nunca llega al renderer)
   └─ Express ─ rutas /consultora/* ─ MCP (stdio) ─ Claude
```

Una sola app, un solo proceso dueño de la base. La ventana Consultora y Claude pasan por los mismos servicios.

## 2. Datos (TypeORM, EntitySchema, migración `CreateConsultora`)

```
clients
  id, name, sector?, status ('activo'|'historico'),
  contacts_md, notes_md, signed_at?, folder_path, created_at, updated_at

projects
  id, client_id → clients, name, status ('activo'|'pausa'|'cerrado'),
  objective_md, deliverables_md, notes_md, created_at, updated_at

pipeline_stages
  id, name, position, kind ('open'|'won'|'lost')          ← 6 por defecto en la migración

prospects
  id, company, contact_md, value_usd?, source?, stage_id → pipeline_stages,
  notes_md, next_step?, next_step_date?, client_id? → clients (al ganar),
  created_at, updated_at

meetings
  id, date (ISO), title, client_id?, project_id?, prospect_id?,
  participants (simple-json: string[]),
  summary_md, decisions_md,
  action_items (simple-json: { text, owner, due?, done }[]),
  transcript_md, raw_notes_md,
  recording_path?, duration_sec?,
  status ('recording'|'transcribing'|'summarizing'|'ready'|'error'), error?,
  created_at, updated_at
```

Decisiones:

- **Documentos sin tabla.** La carpeta es la fuente de verdad; se lee en cada consulta (`fs.readdir` recursivo, profundidad 3).
- **Action items como JSON dentro de la reunión.** Basta para «qué falta»; evita otra tabla. El servicio los aplana para `list_action_items`.
- **Markdown en columnas `_md`.** Lo que la UI muestra es lo que Claude lee.
- **Notas fechadas = añadir al final** del campo `notes_md` una línea `**2026-10-02** — texto`. Alimentar sin pensar dónde va.

## 3. Backend (mismo patrón MVC)

```
src/shared/consultora.ts            tipos, estados, contratos de API, normalizeName()
src/main/config.ts                  settings.json editable desde Ajustes (sin variables de entorno)
src/main/models/{client,project,meeting,prospect,stage}.model.ts
src/main/db/migrations/CreateConsultora.ts
src/main/services/
  client.service.ts       CRUD + crear carpeta + ficha completa (overview)
  project.service.ts      CRUD + marcar entregable
  meeting.service.ts      CRUD + action items + asociación por título
  prospect.service.ts     etapas + CRUD + mover etapa (ganada → cliente + carpeta)
  documents.ts            listar carpeta, leer texto (solo dentro de la carpeta del cliente)
  context.service.ts      panorama, búsqueda (TypeORM Like), notas fechadas, documentos
  ai.service.ts           OpenAI: transcribe(chunks), summarize(text) con Structured Outputs
  recording.service.ts    recibe trozos del renderer → archivo; pipeline audio → texto → resumen
src/main/controllers/ + routes/ + views/   uno por entidad, igual que tasks/notes
src/main/consultora-window.ts       ventana grande; al cerrar se oculta (no se destruye si graba)
```

Resolución por nombre (M6.3): `findClient(ref)` busca por id; si no, por `normalizeName()` (minúsculas, sin acentos)
igual o contenido. 1 resultado → ese; varios → error `ambiguous` con candidatos; 0 → `not_found`.

## 4. Grabación y procesado

### Captura (renderer de la ventana Consultora)

1. `main` registra `session.setDisplayMediaRequestHandler`: entrega la pantalla principal + `audio: 'loopback'`
   (audio del sistema, ScreenCaptureKit, macOS 13+).
2. Renderer: `getDisplayMedia()` (pantalla + sistema) y `getUserMedia({ audio })` (mic).
3. Mezcla de audios con `AudioContext` en una pista; `MediaRecorder` → WebM (VP9 1080p máx. + Opus).
4. Cada 5 s envía el trozo a `main` (`recording:chunk`), que lo agrega al archivo. Nada grande en memoria;
   si la app cae, lo grabado hasta ahí queda en disco.
5. Indicador: punto rojo + cronómetro en la ventana; el icono del menubar cambia mientras graba.

Archivo: `CLIENTS_DOCS_PATH/_reuniones/2026-10-02 1015 <título>.webm`. Al asociar a un cliente, se mueve a
`<Cliente>/Reuniones/` y se actualiza `recording_path`.

### Procesado (main, en segundo plano)

```
webm ─ffmpeg→ audio mono 16 kHz Opus 24 kbps ─ffmpeg→ trozos de 10 min
     ─OpenAI transcribe (uno por trozo, en orden)→ transcript_md
     ─OpenAI summarize (json_schema)→ summary_md, decisions_md, action_items[]
```

- `ffmpeg-static` (binario incluido en la app; `asarUnpack`). Sin instalar nada aparte.
- Trozos de 10 min: muy por debajo del límite de 25 MB de la API y del tope de duración del modelo.
- Resumen con salida estructurada (`response_format: json_schema`) → sin parsear texto libre.
  Prompt incluye título, participantes y cliente/proyecto para que asigne responsables.
  Transcripciones largas (>~100k tokens): se resume por partes y luego se unen (map → reduce).
- Cada paso guarda en la base antes del siguiente: si falla el resumen, la transcripción ya está. «Reintentar» sigue desde donde quedó.
- Al terminar: notificación de macOS «Reunión lista: <título>».
- Coste orientativo: 1 h de reunión ≈ 0,36 USD de transcripción + céntimos de resumen.

### Permisos macOS

Micrófono (`NSMicrophoneUsageDescription`, entitlement `com.apple.security.device.audio-input`),
Grabación de pantalla (Ajustes del Sistema, se pide la primera vez) y acceso a Escritorio
(la carpeta raíz está en `~/Desktop`). El binario lleva firma ad-hoc: **cada reinstalación puede volver a pedir permisos**.

## 5. Ventana Consultora (UI)

```
┌──────────────┬────────────────────────────────────────────┐
│ DayliOS      │  [● Grabar]                       (buscar) │
│              │                                            │
│ Clientes     │   contenido de la sección                  │
│ Reuniones    │                                            │
│ Pipeline     │                                            │
│              │                                            │
│ Ajustes      │                                            │
└──────────────┴────────────────────────────────────────────┘
```

Mismo mundo visual (DESIGN.md): noche, superficies tonales, Nunito, pills; colores con un significado.
Indicador de grabación en **rose** (significado nuevo: «en vivo», además de «destruir»). Se valida con impeccable al construir y se documenta en DESIGN.md.

| Pantalla  | Contenido                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Clientes  | Lista (activos / históricos), nº proyectos activos, última reunión. «Nuevo cliente».                                                  |
| Cliente   | Cabecera (nombre, estado, firma), contactos y notas (markdown), proyectos, reuniones recientes, documentos (árbol + «Abrir carpeta»). |
| Proyecto  | Estado, objetivo, entregables (casillas marcables), notas, reuniones del proyecto.                                                    |
| Reuniones | Lista por día (patrón de Historial) con estado de procesado. «Nueva (sin grabar)».                                                    |
| Reunión   | Resumen, decisiones, action items (marcables), participantes, asociación, transcripción plegada, abrir grabación, «Reintentar».       |
| Pipeline  | Columnas por etapa con tarjetas (empresa, valor, próximo paso con fecha; vencido en butter). Selector de etapa.                       |
| Prospecto | Datos, notas, próximo paso, reuniones de venta, «Convertir en cliente» (o automático al ganar).                                       |
| Ajustes   | API key (guardar, probar, quitar), carpeta de clientes (selector), modelos, idioma, etapas.                                           |

Editores markdown: se reutilizan `Markdown` y `MarkdownEditor` (Escribir/Ver, autoguardado) de Notas.
Navegación: igual que DayliOS, una variable `Screen` sin router.

## 6. API local (Express) — prefijo `/consultora`

| Método   | Ruta                                                                     | Uso                                                                                                           |
| -------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| GET      | `/overview`                                                              | Panorama: clientes activos + proyectos y estado, action items abiertos, pipeline por etapa, últimas reuniones |
| GET/POST | `/clients` · GET/PATCH `/clients/:ref`                                   | `ref` = id o nombre. GET devuelve la ficha completa                                                           |
| GET      | `/clients/:ref/documents` · `/clients/:ref/documents/read?path=`         | listar / leer texto                                                                                           |
| GET/POST | `/projects` · GET/PATCH `/projects/:ref`                                 |                                                                                                               |
| GET/POST | `/meetings` · GET/PATCH `/meetings/:id`                                  | filtros `client`, `project`, `prospect`, `from`, `to`, `page`; `?transcript=1`                                |
| PATCH    | `/meetings/:id/action-items/:index`                                      | marcar hecho / editar                                                                                         |
| POST     | `/meetings/:id/summarize`                                                | resumir notas crudas o reintentar                                                                             |
| GET      | `/action-items?status=open&client=`                                      |                                                                                                               |
| GET/POST | `/prospects` · GET/PATCH `/prospects/:ref` · POST `/prospects/:ref/move` |                                                                                                               |
| GET      | `/pipeline`                                                              | etapas con prospectos y totales                                                                               |
| POST     | `/notes/append`                                                          | `{ entity, ref, text }` añade nota fechada                                                                    |
| GET      | `/search?q=`                                                             | coincidencias en todas las entidades, con fragmento                                                           |

## 7. MCP (herramientas nuevas)

Lectura: `get_overview`, `get_client`, `get_project`, `list_meetings`, `get_meeting` (`include_transcript`),
`list_action_items`, `get_pipeline`, `list_documents`, `read_document`, `search`.
Escritura: `save_client`, `save_project`, `save_prospect`, `move_prospect`, `create_meeting` (notas sin grabación),
`update_meeting`, `update_action_item`, `append_note`.

Descripciones de herramientas escritas para Claude: qué devuelve y cuándo usarla
(«para "¿en qué está X?" usa get_client»).

## 8. Riesgos

| Riesgo                                                   | Mitigación                                                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Audio del sistema (`loopback`) en Electron 39 / tu macOS | Tarea 0: prueba mínima antes de construir la grabación. Plan B: dispositivo virtual BlackHole como entrada |
| Permisos TCC se reinician al reinstalar (firma ad-hoc)   | Documentarlo; firma estable con certificado propio más adelante                                            |
| Videos grandes en Escritorio/Drive (~300–700 MB/h)       | VP9 a 1,2 Mbps y 15 fps; borrar video tras transcribir queda para la siguiente iteración                   |
| Modelo/precio de OpenAI cambia                           | Modelos editables en Ajustes                                                                               |
| Transcripciones muy largas al resumir                    | map → reduce por trozos                                                                                    |
