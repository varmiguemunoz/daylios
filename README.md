# DayliOS

Tareas del día (máximo 8) en el menubar de macOS. SQLite local y servidor MCP para Claude Desktop.

## Uso

```bash
npm install
npm run dev        # desarrollo
npm run build:mac  # genera el .dmg en dist/
```

Datos: `~/Library/Application Support/daily-os/daylios.db`

## Instalar como servicio (macOS)

```bash
npm run service:install     # compila, copia a /Applications, arranca siempre y configura el MCP en Claude
npm run service:uninstall   # quita todo (pregunta antes de borrar tus tareas; --purge para no preguntar)
```

El servicio es un LaunchAgent (`~/Library/LaunchAgents/com.bloomilite.daylios.plist`): arranca al iniciar sesión y, si la app se cierra o falla, launchd la vuelve a abrir. Logs en `~/Library/Logs/daylios.log`. Después de instalar o desinstalar, reinicia Claude (⌘Q) para que cargue el cambio del MCP.

## Arquitectura

```
src/shared/            dominio: tipos, contrato TasksApi, techo de 8, fechas
src/main/
  index.ts             arranque
  window.ts            ventana popover + icono del menubar
  ipc.ts               UI → servicio
  server.ts            Express (127.0.0.1 + token) → lo usa el MCP
  db/                  DataSource de TypeORM + migraciones
  models/              M: modelos Task y Note (EntitySchema)
  views/               V: forma del JSON
  controllers/         C: petición → servicio → vista
  routes/              rutas → controlador
  services/            reglas: tareas, notas y consultora (clientes, proyectos, pipeline, reuniones, AI, grabación)
  consultora.ts        crea los servicios de la consultora
  consultora-window.ts ventana grande + captura de pantalla con audio del sistema
  config.ts            ajustes (settings.json), editables desde la ventana
  guards/              transacciones: todo o nada, de una en una
  middlewares/         token, aviso a la ventana, errores
src/mcp/               servidor MCP stdio → API local
src/preload/           puente seguro window.api
src/renderer/          UI React
```

Specs (SDD) en `.kiro/specs/`. Consultora: `.kiro/specs/consultora-context/`. Email marketing: `.kiro/specs/email-automations/`.

Tests: `npm test` (Vitest dentro de Electron, porque better-sqlite3 está compilado para su ABI; base SQLite en memoria con las migraciones reales y un Resend falso). Incluye la lógica del Worker `workers/leads-hub`.

La app es la única que abre la base de datos. La UI y Claude pasan por el mismo servicio, así que las reglas (techo de 8, validación) son idénticas. Si Claude cambia algo, la ventana se refresca sola.

Al arrancar, la app escribe `connection.json` (puerto + token, permisos 600) junto a la base de datos. El MCP lo lee en cada llamada. **La app tiene que estar abierta** para que Claude pueda usarla; con `npm run service:install` queda siempre corriendo.

## Consultora (clientes, proyectos, reuniones, pipeline)

Ventana aparte para el contexto de la consultora: clic derecho en el icono del menubar → **Abrir Consultora**, o el botón del maletín junto a las pestañas.

- **Clientes**: crear uno crea su carpeta en `CLIENTS_DOCS_PATH/<Nombre>/` con `Contratos/`, `Entregables/`, `Documentación técnica/`, `Reuniones/`. Los documentos se leen en vivo de esa carpeta.
- **Proyectos**: objetivo, entregables (casillas `- [ ]` marcables), notas y reuniones.
- **Reuniones**: «Grabar reunión» graba pantalla + micrófono + audio del sistema. Al detener se transcribe (OpenAI Whisper) y se resume: resumen ejecutivo, decisiones y action items. También se pueden crear sin grabar.
- **Pipeline**: etapas configurables (Ajustes). Pasar un prospecto a una etapa _ganada_ lo convierte en cliente con su carpeta.

### Ajustes

Todo se configura desde la app: **Consultora → Ajustes**.

- **API key de OpenAI**: pégala y pulsa Guardar (se prueba sola). La ventana nunca vuelve a mostrarla completa.
- **Carpeta de clientes**: por defecto `~/Desktop/alimunozadvisory`; «Cambiar…» abre el selector de macOS.
- **Modelos e idioma del resumen**: `whisper-1`, `gpt-4o-mini`, español por defecto.

Se guardan en `~/Library/Application Support/daily-os/settings.json` (permisos 600) y aplican al momento, sin reiniciar.

### Permisos de macOS

La primera grabación pide **Micrófono** y **Grabación de pantalla y audio del sistema** (Ajustes del Sistema → Privacidad). La carpeta raíz en el Escritorio también puede pedir acceso. La app lleva firma local (ad-hoc): tras reinstalar, macOS puede volver a pedirlos.

Grabaciones: `CLIENTS_DOCS_PATH/_reuniones/` hasta que se asocian a un cliente; entonces se mueven a `<Cliente>/Reuniones/`. Coste orientativo: 1 h ≈ 0,36 USD de transcripción.

## Email marketing (leads, secuencias, newsletter)

Un GoHighLevel pequeño dentro de la Consultora: **Contactos** (personas de clientes y prospectos, y leads de email en la misma base) y el grupo **Email**: Fuentes, Reglas, Secuencias y Newsletters. Spec: `.kiro/specs/email-automations/`.

```
Formulario / Zapier / Make ──POST /in/<fuente>──▶ Worker leads-hub (Cloudflare, siempre encendido)
                                                   │ escribe en Resend: contacto, segments, eventos
                                                   └─ cola D1 ──▶ DayliOS la descarga cada minuto
Resend: Automations (secuencias) · Broadcasts (newsletter) · webhooks de bajas/rebotes ──▶ Worker
Claude Cowork ──MCP──▶ DayliOS ──▶ Resend (newsletter diario, secuencias, tags)
```

- **Solo opt-in.** Un contacto creado a mano queda «Sin marketing»; suscribirlo pide confirmar que dio su permiso. Los leads de una fuente entran suscritos y guardan fuente y fecha como prueba de consentimiento.
- **Tags**: cada lead lleva `origen-<fuente>` y los tags por defecto de la fuente. Cada tag es un Segment de Resend (`tag:<slug>`). Al entrar en un tag, un suscrito dispara el evento `tag.<slug>`; uno nuevo, `lead.created`.
- **Reglas**: «cuando entra el tag X → añadir/quitar tag, disparar evento, pasar a pipeline». Corren en el Worker al recibir un lead y en la app al etiquetar.
- **Secuencias**: Automations de Resend. Se crean en su dashboard o pidiéndoselas a Claude (`save_sequence`). Resend no deja editar una activa: hay que pausarla.
- **Newsletter**: lo escribe y lo envía Claude (`send_newsletter`). Salvaguardas: pausa global, máximo uno por día, tag con suscritos, copia previa a tu email, enlace de baja obligatorio e historial. Si algún suscrito del tag aún no está sincronizado con Resend, no se envía.
- **Sin conexión**: todo cambio hacia Resend pasa por una cola local con reintentos (1 min → 6 h). Ajustes → Email muestra lo pendiente.

### Puesta en marcha

1. **Resend** (plan pago para pasar de 100 emails/día): dominio verificado (SPF, DKIM, DMARC) y una API key con acceso completo.
2. **Consultora → Ajustes → Email (Resend)**: API key, remitente (`hola@tudominio.com`), nombre, «responder a» y tu email (recibe la copia de cada newsletter).
3. **Worker**: sigue `workers/leads-hub/README.md` (crear D1, secretos y desplegar).
4. **Ajustes → Hub de leads**: URL del Worker y el mismo `ADMIN_TOKEN`. «Probar conexión».
5. **Resend → Webhooks**: `https://<worker>/resend/webhook` con `contact.updated`, `email.bounced` y `email.complained`. Copia el signing secret al Worker (`RESEND_WEBHOOK_SECRET`).
6. **Fuentes**: crea una por cada sitio que manda leads y pega su URL y secreto en la herramienta (cabecera `Authorization: Bearer <secreto>`, o `?key=<secreto>`). Formato:

```json
{ "email": "ana@ejemplo.com", "name": "Ana", "tags": ["webinar"], "fields": { "company": "Acme" } }
```

### Newsletter diario con Claude Cowork

Tarea programada (por ejemplo, de lunes a viernes a las 08:00):

> Usa get_newsletter_context. Si está en pausa o ya se envió hoy, termina sin hacer nada. Elige el tag con suscritos que toque hoy (alterna entre ellos) y escribe un newsletter breve y útil en español para educar a esos contactos sobre integración de software y AI: un tema que no aparezca en los últimos asuntos, un asunto claro de menos de 60 caracteres, 3–5 párrafos cortos en HTML simple y una sola llamada a la acción. Sin datos inventados ni promesas. Envíalo con send_newsletter. Si falla, explica el error.

Las tareas programadas y la app corren con el Mac despierto. Las secuencias y la recepción de leads no dependen del Mac.

## Tareas: tags y esfuerzo

Escribe `Propuesta Acme #ventas !alto` y se guarda la tarea «Propuesta Acme» con el tag `ventas` y esfuerzo alto (`!a`, `!m`, `!b` también valen). En el detalle se editan ambos. Arrastra las filas de Hoy para ordenarlas.

## Nota de voz

Mantén pulsado **⌥ Espacio** en cualquier app, habla y suelta. Aparece una pastilla arriba («● Escuchando»); al soltar, DayliOS transcribe (Whisper), escribe la nota en markdown (título, listas, casillas para tareas) y la guarda en **Notas**. La notificación «Nota creada» abre la nota.

- El atajo se cambia o desactiva en **Consultora → Ajustes → Nota de voz**.
- «Mantener pulsado» necesita el permiso de **Accesibilidad** (solo para saber cuándo sueltas la tecla). Sin él, funciona como interruptor: pulsa para empezar y otra vez para terminar.
- Menos de 1 s se ignora; máximo 10 min. El audio se borra al terminar; si la transcripción falla, queda en Ajustes con «Reintentar».

## Firma y permisos

`service:install` firma la app con tu certificado de Xcode («Apple Development») si existe. Así macOS conserva los permisos (Grabación de pantalla, Micrófono, Accesibilidad) entre reinstalaciones. La primera vez con la firma nueva los pedirá una última vez, y macOS puede preguntar si `codesign` puede usar la clave: elige «Permitir siempre». Para forzar un certificado: `DAYLIOS_SIGN_IDENTITY="Apple Development: …" npm run service:install`.

Tras conceder **Grabación de pantalla**, macOS exige reiniciar la app: usa el botón «Reiniciar DayliOS» del aviso de permisos.

## Conectar Claude Desktop

Edita `~/Library/Application Support/Claude/claude_desktop_config.json` y reinicia Claude.

Desarrollo (después de `npm run build` o `npm run dev`):

```json
{
  "mcpServers": {
    "daylios": {
      "command": "node",
      "args": ["/Users/varmiguemunoz/varmiguemunoz/daily-os/out/main/mcp.js"]
    }
  }
}
```

App instalada en `/Applications`:

```json
{
  "mcpServers": {
    "daylios": {
      "command": "/Applications/daily-os.app/Contents/MacOS/daily-os",
      "args": ["/Applications/daily-os.app/Contents/Resources/app.asar/out/main/mcp.js"],
      "env": { "ELECTRON_RUN_AS_NODE": "1" }
    }
  }
}
```

### Herramientas

| Herramienta          | Qué hace                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `get_day`            | Tareas del día + resumen (total, hechas, pendientes, huecos libres, techo). Sin fecha = hoy |
| `get_history`        | Historial por días, paginado, filtrable con `from` / `to`                                   |
| `create_task`        | Crea una tarea (falla si el día ya tiene 8)                                                 |
| `update_task`        | Cambia el título y/o marca como hecha o pendiente                                           |
| `delete_task`        | Elimina una tarea                                                                           |
| `move_task`          | Mueve una tarea a otro día                                                                  |
| `carry_over_pending` | Mueve las pendientes de un día a otro (por defecto de ayer a hoy)                           |
| `list_notes`         | Notas por día (más reciente primero), paginadas; cada una con `title`, `excerpt` y `body`   |
| `get_note`           | Una nota completa                                                                           |
| `create_note`        | Crea una nota en markdown (la primera línea es el título)                                   |
| `update_note`        | Reemplaza el contenido de una nota                                                          |
| `delete_note`        | Elimina una nota                                                                            |

`create_task` y `update_task` aceptan `description` (markdown), `tags` y `effort` (alto/medio/bajo). En el título también funcionan `#tag` y `!alto` / `!medio` / `!bajo`.

Consultora (las referencias aceptan id o nombre):

| Herramienta                                      | Qué hace                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `get_overview`                                   | Panorama: clientes activos y proyectos, action items abiertos, pipeline, próximos pasos, últimas reuniones |
| `get_client` · `list_clients`                    | Ficha completa de un cliente (proyectos, reuniones, pendientes, documentos) · lista                        |
| `get_project`                                    | Proyecto con entregables pendientes y reuniones                                                            |
| `list_meetings` · `get_meeting`                  | Reuniones por día · una reunión (transcripción con `include_transcript`)                                   |
| `list_action_items` · `update_action_item`       | Pendientes de reuniones · marcar hecho                                                                     |
| `get_pipeline` · `get_prospect`                  | Pipeline por etapas · un prospecto                                                                         |
| `list_documents` · `read_document`               | Archivos de la carpeta del cliente · leer texto (.md/.txt/.csv/.json)                                      |
| `search`                                         | Texto en clientes, proyectos, reuniones (incluidas transcripciones) y prospectos                           |
| `save_client` · `save_project` · `save_prospect` | Crear o editar                                                                                             |
| `move_prospect`                                  | Cambiar de etapa (ganado = cliente nuevo + carpeta)                                                        |
| `create_meeting` · `update_meeting`              | Reunión sin grabación (con `process` para resumir notas) · editar                                          |
| `append_note`                                    | Nota fechada al final de un cliente, proyecto, prospecto o reunión                                         |

Contactos y email marketing:

| Herramienta                                                       | Qué hace                                                                                                   |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `list_contacts` · `get_contact` · `save_contact`                  | Contactos con filtros (tag, estado, fuente, texto), paginados · ficha con línea de tiempo · crear o editar |
| `tag_contact`                                                     | Añadir o quitar tags (dispara reglas y, si está suscrito, `tag.<slug>` en Resend)                          |
| `set_contact_subscription`                                        | Suscribir (solo con su permiso) o dar de baja                                                              |
| `promote_contact`                                                 | Pasar a pipeline (crea el prospecto)                                                                       |
| `list_tags` · `list_sources`                                      | Tags con nº de suscritos · fuentes con leads recibidos                                                     |
| `list_rules` · `save_rule` · `delete_rule`                        | Reglas por tag                                                                                             |
| `list_sequences` · `save_sequence` · `set_sequence_status`        | Secuencias de Resend: listar · crear o reescribir (evento → espera → email…) · activar o pausar            |
| `get_newsletter_context` · `send_newsletter` · `list_newsletters` | Antes de escribir · enviar el de hoy (uno por día) · historial                                             |

## Atajos

| Atajo          | Qué hace                                     |
| -------------- | -------------------------------------------- |
| `⌘1` `⌘2` `⌘3` | Hoy · Historial · Notas                      |
| `⌘N`           | Nueva tarea (en Hoy) o nueva nota (en Notas) |
| `Enter` / clic | Abrir el detalle de una tarea                |
| `Espacio`      | Completar la tarea enfocada                  |
| `⌘E`           | Escribir / Ver en descripción y notas        |
| `⌘Z`           | Deshacer el último borrado de tarea          |
| `Esc`          | Volver (en detalle) o cerrar la ventana      |

Ejemplo de tarea programada al final del día: _"Usa get_day para ver hoy. Resume lo hecho y lo pendiente, y usa carry_over_pending de hoy a mañana."_
