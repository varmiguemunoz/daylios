# Requisitos · Email automations (mini-GHL)

## Contexto

DayliOS ya guarda clientes, prospectos y contactos de Ali Muñoz Advisory. Falta poder captar
leads desde fuera (formularios, Zapier, Make, la web), etiquetarlos según por dónde entran,
automatizar qué pasa con ellos y enviarles emails: secuencias de venta y un newsletter diario
que escribe Claude.

Inspiración: GoHighLevel, pero más pequeño. Lo justo para ser útil a una sola persona.

Decisiones tomadas con el dueño:

- Motor **híbrido**: un Cloudflare Worker recibe webhooks aunque el Mac esté apagado; la app
  descarga lo recibido cuando está abierta.
- Proveedor de email: **Resend** (plan pago, sin tope diario). Dominio ya verificado.
- **Solo opt-in**: nunca se envía a quien no dio su consentimiento.
- Las secuencias y el newsletter **corren en Resend** (Automations y Broadcasts). DayliOS es el
  CRM: personas, tags, fuentes, reglas e historial.
- Una sola tabla de personas: el lead es un `Contact` (la misma entidad que ya usan clientes y
  prospectos).
- El newsletter es 100 % automático: lo escribe y lo envía Claude Cowork Desktop con una tarea
  programada, a través del MCP de DayliOS.

## R1 · Contactos

- R1.1 Un lead es un `Contact`. El nombre pasa a ser opcional; si falta, la UI muestra el email.
- R1.2 El email se guarda en minúsculas y es único entre los contactos que lo tienen.
- R1.3 Campos nuevos: estado de suscripción, fuente, campos libres (`fields`, JSON), fecha de
  consentimiento (`consentAt`), estado de sincronización con Resend.
- R1.4 Estados: `none` (contacto de trabajo, nunca recibe marketing), `subscribed`,
  `unsubscribed`, `bounced`, `complained`. Solo `subscribed` recibe emails.
- R1.5 Suscribir a mano exige email y marca el consentimiento (fuente `manual`).
- R1.6 Cada contacto tiene una línea de tiempo de eventos (entró por fuente X, tag añadido,
  sincronizado, baja, promovido…).
- R1.7 «Pasar a pipeline»: crea un `Prospect` en la etapa elegida y enlaza `contact.prospectId`.
  Si ya tiene prospecto, no crea otro.

## R2 · Tags

- R2.1 Un contacto tiene 0..n tags. Un tag tiene `slug` (`a-z0-9-`) y nombre visible.
- R2.2 Cada fuente aplica automáticamente su tag de origen `origen-<fuente>` más sus tags por
  defecto.
- R2.3 Cada tag corresponde a un Segment de Resend (`tag:<slug>`), creado la primera vez que hace
  falta.
- R2.4 Cuando un contacto suscrito entra en un tag por primera vez, se dispara en Resend el
  evento `tag.<slug>` (las secuencias se enganchan a él).

## R3 · Webhooks de entrada

- R3.1 Un Cloudflare Worker expone `POST /in/<fuente>`. Cada fuente tiene su secreto
  (cabecera `Authorization: Bearer <secreto>` o `?key=<secreto>` para herramientas que no
  permiten cabeceras).
- R3.2 Formato único: `{ "email": "...", "name": "...", "tags": ["..."], "fields": { ... } }`.
  Solo `email` es obligatorio.
- R3.3 Respuestas: 202 aceptado; 400 payload inválido; 401 secreto inválido; 404 fuente
  desconocida; 413 cuerpo demasiado grande.

## R4 · Ingesta

- R4.1 El Worker escribe directo en Resend: crea o actualiza el contacto, lo añade a los Segments
  de sus tags y dispara `lead.created` (contacto nuevo) y `tag.<slug>` (tags nuevos).
- R4.2 Además deja el lead en una cola (D1). La app descarga la cola al arrancar, cada 60 s y al
  despertar el Mac, la guarda en SQLite y la confirma (ack). Solo se confirma lo ya guardado.
- R4.3 Si Resend falla en el Worker, el lead igual se encola y la app completa la
  sincronización.
- R4.4 Un contacto dado de baja en Resend no se vuelve a suscribir por un webhook.

## R5 · Reglas por tag

- R5.1 Regla: «cuando entra el tag X → acciones». Acciones: añadir tag, quitar tag, disparar
  evento de Resend, pasar a pipeline en la etapa Y.
- R5.2 Las reglas se encadenan (un tag añadido por una regla puede activar otra), con un límite
  de profundidad para evitar bucles.
- R5.3 Se evalúan en el Worker al recibir un lead y en la app cuando se añade un tag a mano o
  desde Claude. «Pasar a pipeline» siempre se ejecuta en la app.
- R5.4 DayliOS es la fuente de verdad de fuentes y reglas; cada cambio se envía al Worker.

## R6 · Secuencias

- R6.1 Las secuencias son Automations de Resend.
- R6.2 La app lista las secuencias (nombre, estado, evento que la dispara, nº de pasos) con
  enlace al dashboard de Resend.
- R6.3 Claude puede crear o reescribir una secuencia lineal (evento → [espera] → email → …) y
  activarla o pausarla vía MCP. Los emails se guardan como Templates de Resend.

## R7 · Newsletter automático

- R7.1 Claude envía el newsletter con la herramienta MCP `send_newsletter` (tag, asunto, HTML,
  hora opcional).
- R7.2 Salvaguardas: pausa global en Ajustes; máximo 1 por día local; el tag debe existir y tener
  suscriptores; se añade el pie de baja `{{{RESEND_UNSUBSCRIBE_URL}}}` si falta; antes del envío
  se manda una copia al email del dueño.
- R7.3 Historial local: fecha, tag, asunto, HTML, estado (`sending`, `scheduled`, `sent`,
  `failed`), error.
- R7.4 `get_newsletter_context` da a Claude los últimos asuntos y el tamaño de cada tag para no
  repetir temas.

## R8 · Volumen y consentimiento

- R8.1 ≥ 1000 emails/día (plan pago de Resend; la cola y el ritmo de envío los gestiona Resend).
- R8.2 La fuente y la fecha de entrada se guardan como prueba de consentimiento.
- R8.3 La app respeta el límite de 10 peticiones/s de la API de Resend.

## R9 · Interfaz

- R9.1 En la ventana Consultora: Contactos (lista con filtros por tag, estado y fuente),
  ficha de contacto (tags, línea de tiempo, pasar a pipeline), Fuentes, Reglas, Secuencias y
  Newsletters.
- R9.2 Ajustes: «Email (Resend)» (API key, remitente, responder a, email del dueño, probar) y
  «Hub» (URL del Worker, token de administración, probar).

## R10 · Datos iniciales

- R10.1 Sin importación: se empieza vacío.

## Fuera de alcance

- Builder visual de flujos en DayliOS (se usa el de Resend).
- Mapeo de campos por fuente (cada herramienta adapta su payload al formato único).
- SMS, WhatsApp, multiusuario, Keychain para los secretos.
