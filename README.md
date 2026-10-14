# DayliOS

Tareas del día (máximo 8) en el menubar de macOS. SQLite local y servidor MCP para Claude Desktop.

## Uso

```bash
npm install
npm run dev        # desarrollo
npm run build:mac  # genera el .dmg en dist/
```

Datos: `~/Library/Application Support/daily-os/daylios.db`

## La interfaz se recuerda

Como Obsidian, las ventanas vuelven como las dejaste. El estado vive en `ui-state.json`, en la carpeta
de datos de la app, nunca en la caché del navegador interno, y no se sincroniza.

- **Menubar**: cada pestaña conserva su scroll, el periodo y la página de Historial, la página de Notas
  y lo escrito en «Añade una tarea…». Volver de una tarea o nota deja la lista donde estaba. Al
  reiniciar se abre lo último, también una tarea o nota.
- **Fijar** con la chincheta de arriba a la derecha: la ventana no se oculta al cambiar de app, se
  mueve arrastrando el borde de arriba o la barra inferior y se puede hacer más alta. Recuerda su sitio.
- **Consultora**: última pantalla con su historial de atrás y adelante, la última pantalla de cada
  sección, filtros y páginas de las listas, scroll de cada pantalla, zoom de cada board, scroll de
  cada nota y tamaño de la ventana.
- **Restablecer**: Ajustes, General, «Restablecer el diseño de las ventanas».

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

## Ediciones y nube

DayliOS arranca en la edición Local: SQLite y la bóveda en este Mac, sin cuenta y sin conexiones
de nube. La edición Equipo, en construcción, suma cuenta, organización y sincronización. Ajustes,
«Cuenta y equipo», muestra la activa.

- Los servicios locales hablan con puertos (`src/main/ports`). En Local los atienden adaptadores
  vacíos; el código de nube (`src/main/cloud`) solo se carga en Equipo.
- Cada cambio en las tablas sincronizables deja una fila en `change_log` por triggers de SQLite.
  En Local se queda en las últimas 10 000.
- Borrar clientes, proyectos, reuniones, prospectos, pipelines, contactos, tags, fuentes, reglas o
  tareas marca `deleted_at`. Se purgan a los 30 días.
- Nunca salen del Mac: `settings.json`, claves de API, tokens, `ui-state.json`, secretos de las
  fuentes, la cola de voz, grabaciones en curso y el outbox del email (`NEVER_SYNC`).
- Microservicio en `services/cloud`, NestJS hexagonal sobre Supabase. Ver su README.

### Cuenta

Ajustes, «Cuenta y equipo»: «Continuar con Google» o un código por email, sin contraseñas.
Iniciar sesión activa la edición Equipo pero no sube datos. La sesión se cifra con el Llavero de
macOS y se renueva sola; si caduca, la app sigue en local y la franja muestra «Volver a entrar».
Desde ahí también se cambia el nombre, se ven los dispositivos, se cierra sesión aquí o en los
demás y se borra la cuenta. Configuración en `.env` con las variables de `.env.example`.

### Organizaciones

Con sesión, el botón de abajo en la cinta cambia entre Local y tus organizaciones, o crea una nueva.
Cada organización tiene su propia base y su bóveda en `Organizaciones` dentro de tu carpeta de
documentos; Local queda intacto. Cambiar de espacio reinicia la app. En «Cuenta y equipo» se ven
los miembros con su rol, las invitaciones por email o por enlace, salir, transferir y borrar. Las
tareas, prospectos, proyectos y reuniones ganan «Responsable», y Tareas e Inicio tienen «Mis
tareas».

### Sincronización

Dentro de una organización, cada cambio llega a los demás miembros en segundos y todo sigue
funcionando sin red: los cambios esperan en cola. Si dos personas cambian campos distintos se
conservan los dos; si cambian el mismo, gana el último. El icono de nube de la franja muestra el
estado, lo que hay en cola, permite pausar, sincronizar ahora o volver a descargar, y lista lo que
otra persona borró con la opción de restaurarlo. En Local no hay ningún proceso de sincronización.

### Equipo en tiempo real

En la franja aparecen las iniciales de quien está conectado en la organización. Si otra persona
tiene abierta la misma ficha o nota se ve junto al título, y mientras escribe aparece «Ana está
editando». No bloquea, solo avisa. La pestaña «Actividad» de la barra lateral lista por día lo que
hizo el equipo: crear, cambiar, mover de etapa, ganar o perder, completar, asignar, subir, renombrar
o borrar archivos, invitar y unirse. Se filtra por persona, tipo y elemento, muestra cuántas
novedades no has visto y un clic abre el elemento. Cada ficha muestra su propia actividad al final.
Cuando te asignan una tarea, un prospecto o una reunión llega un aviso del sistema. En Ajustes,
Cuenta, Equipo se apagan los avisos por tipo y se puede ocultar la propia presencia. Lo que otra
persona acaba de cambiar se resalta un momento en tareas, prospectos, clientes y contactos.

### Archivos

Dentro de una organización, la carpeta de documentos de la organización se sube a la nube de
Cloudflare R2 y llega a los demás miembros. Solo se sube el contenido que cambió: renombrar o
mover una carpeta no vuelve a subir nada y el mismo archivo en dos lugares se guarda una vez. Los
archivos grandes suben por partes y, si se corta la red, siguen donde quedaron. Si dos personas
editan el mismo archivo sin conexión, queda una copia con el nombre de quien la hizo. Lo que otro
borra va a la papelera del sistema y a la papelera de la organización por 30 días, desde donde se
restaura en Ajustes, Cuenta. Las grabaciones de reuniones no se suben salvo que se active el
interruptor. Un punto junto a cada archivo del explorador muestra si está en la nube, subiendo,
bajando o en conflicto.

## Workspace (notas, boards y archivos)

Primera sección de Consultora, con el aspecto de Obsidian. Es una carpeta real: por defecto
`<carpeta de clientes>/Workspace`, se cambia en Ajustes. Lo que hay dentro se ve igual en Finder, en Obsidian y en la
app; si cambias algo fuera, la app lo ve en menos de 2 s.

- **Atajo global**: ⌥⌘W abre el workspace en la última nota desde cualquier app; otra vez lo oculta. Se cambia en
  Ajustes. Dentro no hay barra lateral ni cabecera de Consultora; la cinta de la izquierda abre la navegación.
- **Atajos dentro**: ⌘O o ⌘F buscar y abrir, ⌘K buscar en todo, ⌘N nota nueva, ⌘\ mostrar u ocultar la barra lateral.
- **Explorador**: un árbol de carpetas y archivos. Arrastra para mover, suelta archivos de Finder para subirlos
  (50 MB máximo), clic derecho para el menú. Borrar manda a la Papelera.
- **Notas**: archivos `.md`. El primer título de la nota es el nombre del archivo. Doble clic para escribir; al
  salir o tras 2 s sin teclear vuelve a la lectura. Las del menubar y las de voz caen en `Notas rápidas/`. Pega una
  imagen y se guarda en `Adjuntos/`.
- **Boards**: archivos `.canvas` (JSON Canvas, se abren también en Obsidian). Tarjetas, formas, imágenes, notas
  incrustadas, grupos y flechas con rótulo. Doble clic en el fondo crea una tarjeta; soltar una flecha en el vacío
  crea una tarjeta conectada. ⌘G agrupa y lo que está dentro se mueve con el grupo. ⌘C, ⌘V, ⌘D, ⌘Z, ⇧⌘Z, flechas
  para mover, ⌥ para colocar sin rejilla.
- Mover o renombrar actualiza los enlaces de notas e imágenes de boards que apuntan a lo movido.

## Consultora (clientes, proyectos, reuniones, pipeline)

Ventana aparte para el contexto de la consultora: clic derecho en el icono del menubar → **Abrir Consultora**, o el botón del maletín junto a las pestañas.

Toda la ventana tiene el aspecto de Obsidian: franja superior con atrás, adelante y la ruta; cinta de iconos; barra
lateral con las pestañas **Secciones** y **Archivos**. Atajos: ⌘K buscar en todo, ⌘O abrir un archivo de la bóveda,
⌘N nota nueva, ⌘\ barra lateral, ⌘[ y ⌘] atrás y adelante, ⌘, Ajustes.

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

## Inicio

Primera sección de Consultora. Un dashboard con componentes elegibles: tareas abiertas y cerradas, tareas por estado, pipeline abierto, negocios ganados y perdidos, valor por etapa, tasa de cierre, atrasadas, reuniones, action items y contactos nuevos. Cada número se compara con el periodo anterior y un clic en el título abre su origen filtrado. «Editar dashboard» permite añadir, quitar, mover y dar a cada componente su propio tamaño, periodo o pipeline. El diseño se guarda en la base, no en el estado de la ventana. Claude lee los mismos números con `get_metrics`.

## Tablero de tareas

En Consultora, sección Tareas. Las mismas tareas del menubar con tres estados: Pendiente, En curso y Hecha. Se ven como tablero o como lista ordenable, con filtros por periodo, texto, tags, esfuerzo y relación. Arrastrar una tarjeta cambia su estado; Hecha equivale a marcarla en el menubar. Cada tarea puede relacionarse con un cliente, un proyecto o un prospecto y aparece en su ficha. El límite de ocho por día se mantiene.

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

Las herramientas que borran piden `confirm: true`: sin él devuelven el impacto y no borran. Las referencias a
clientes, proyectos, prospectos, pipelines y etapas aceptan id o nombre. Excepciones a propósito: claves y secretos,
permisos de macOS y empezar o detener una grabación en vivo.

| Dominio    | Herramientas                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Día        | `get_day` · `get_history` · `create_task` (con `parent` crea una subtarea) · `get_task` · `update_task` · `delete_task` · `move_task` · `list_tasks` (tablero con estado y filtros) · `carry_over_pending` · `reorder_tasks` · `reorder_subtasks` · `complete_subtasks`                                                                     |
| Notas      | `list_notes` · `get_note` (con relaciones) · `create_note` · `update_note` · `delete_note` · `search_notes` · `link_notes` · `unlink_notes` · `link_note_client` · `unlink_note_client`                                                                                                                                                     |
| Clientes   | `get_overview` · `list_clients` · `get_client` · `save_client` · `get_client_impact` · `delete_client` · `get_project` · `save_project` · `delete_project` · `search` · `append_note`                                                                                                                                                       |
| Documentos | `list_documents` · `read_document` · `write_document` · `rename_document` · `delete_document` (a la Papelera)                                                                                                                                                                                                                               |
| Reuniones  | `list_meetings` · `get_meeting` · `create_meeting` · `update_meeting` · `process_meeting` · `delete_meeting` · `list_action_items` · `update_action_item` · `import_recording`                                                                                                                                                              |
| Pipelines  | `list_pipelines` · `get_pipeline` · `get_metrics` (los números de Inicio) · `save_pipeline` · `delete_pipeline` · `get_prospect` · `save_prospect` · `move_prospect` · `delete_prospect`                                                                                                                                                    |
| Contactos  | `list_contacts` · `get_contact` · `save_contact` · `delete_contact` · `tag_contact` · `set_contact_subscription` · `convert_contact` (alias `promote_contact`) · `detach_contact_prospect`                                                                                                                                                  |
| Tags       | `list_tags` (`kind`: contact o task) · `rename_tag` · `set_tag_audience` · `delete_tag` · `rename_task_tag` · `delete_task_tag`                                                                                                                                                                                                             |
| Workspace  | `workspace_tree` · `workspace_list` · `workspace_search` · `workspace_read` · `workspace_write_note` · `workspace_create_folder` · `workspace_move` · `workspace_delete` (a la Papelera) · `workspace_create_board` · `board_read` · `board_edit`                                                                                           |
| Email      | `list_sources` · `save_source` · `rotate_source_secret` · `delete_source` · `list_rules` · `save_rule` · `delete_rule` · `list_sequences` · `get_sequence` · `save_sequence` · `set_sequence_status` · `get_newsletter_context` · `send_newsletter` · `list_newsletters` · `get_newsletter` · `get_marketing_status` · `sync_marketing_now` |

`create_task` y `update_task` aceptan `description` (markdown), `tags` y `effort` (alto/medio/bajo). En el título también funcionan `#tag` y `!alto` / `!medio` / `!bajo`. `update_task` además acepta `status` (todo, doing, done) y `client`, `project` o `prospect` por id; cadena vacía quita la relación.

Tags audiencia: solo los tags marcados como audiencia (pantalla Tags o `set_tag_audience`) tienen Segment en Resend y
pueden recibir newsletters. Los eventos `tag.<slug>` de las secuencias funcionan con cualquier tag. Tras actualizar,
**redespliega el Worker** (`cd workers/leads-hub && npm run deploy`) para que también respete las audiencias.

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
