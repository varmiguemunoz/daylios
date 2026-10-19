# Requisitos · Capa de proveedores de email

## Contexto

Alisuite depende de Resend de forma directa en varios sitios. El dueño quiere enviar correo en frío
a sus prospectos y poder cambiar o sumar proveedores de entrega sin tocar la arquitectura.

Inventario del código actual:

| Pieza | Archivo | Qué hace con Resend |
| --- | --- | --- |
| Gateway | `src/shared/resend-gateway.ts` | Interfaz de 17 métodos y su implementación con el SDK `resend` |
| Caché de gateway | `src/main/services/resend.provider.ts` | Una instancia por clave |
| Sincronización | `src/main/services/marketing-sync.ts` | Contactos, segments y eventos desde la cola `resend_outbox` |
| Secuencias | `src/main/services/sequence.service.ts` | Automations y templates de Resend |
| Newsletter | `src/main/services/newsletter.service.ts` | Segments, copia de prueba y broadcast |
| Automatizaciones | `src/main/automations/adapters.ts` | Puerto `EmailPort` con errores de Resend |
| Hub | `workers/leads-hub/src/hub.ts` e `index.ts` | Gateway, webhook firmado svix y estados |
| Servicio cloud | `services/cloud/src/adapters/mail/resend-mailer.ts` | Invitaciones por `fetch`, plantilla incluida |
| Ajustes | `src/main/config.ts`, `SettingsEmail.tsx` | `resendApiKey`, remitente, responder a |
| Pruebas | `src/main/test/fake-resend.ts` | Fake usado por cuatro suites |

Decisiones tomadas con el dueño:

1. No se elimina Resend. Pasa a ser un proveedor más detrás de la capa y sigue siendo el de
   transaccional y marketing.
2. Primer proveedor nuevo: Apollo, para outreach en frío, con el plan Basic.
3. WhatsApp y SMS quedan fuera de este spec.
4. Mañana se podrán sumar AWS SES, Instantly u otros sin cambiar dominio ni consumidores.
5. La capa debe poder extraerse a un paquete sin reescribirla.
6. Resend prohíbe el correo en frío en su política de uso aceptable. Por eso el outreach no va por
   Resend y la capa lo impide por diseño.

## R1 · Capa y puertos

- R1.1 Existe una carpeta autocontenida `src/shared/email-delivery` sin imports hacia main,
  renderer, preload, mcp, services ni workers.
- R1.2 La capa define cinco puertos pequeños, uno por capacidad: `EmailSender`, `AudienceStore`,
  `SequenceEngine`, `BroadcastSender` y `DeliveryEventSource`.
- R1.3 Un proveedor expone solo los puertos que implementa. Pedir uno que no tiene lanza
  `CapabilityNotSupported`.
- R1.4 Dominio, puertos y aplicación no importan SDKs, Node ni Electron. Solo
  `providers/<id>` conoce su SDK o su API. ESLint lo impone.
- R1.5 Los consumidores importan solo desde `index.ts` de la capa, nunca desde `providers/*`.

## R2 · Roles y enrutado

- R2.1 Hay tres roles: `transactional`, `marketing` y `outreach`. Cada rol apunta a un proveedor
  o a ninguno.
- R2.2 Valores por defecto: `transactional` y `marketing` a Resend, `outreach` sin asignar. Con
  esa configuración el comportamiento actual no cambia.
- R2.3 Pedir un rol sin proveedor o sin credenciales lanza un error claro que dice qué falta y
  dónde configurarlo.
- R2.4 Asignar `outreach` a un proveedor cuya política no permite correo en frío se rechaza. Resend
  y SES quedan con `coldOutreach: false`.
- R2.5 Cambiar el proveedor de un rol no exige editar ningún consumidor.
- R2.6 Los ids remotos guardados, como segments y broadcasts, pertenecen a un proveedor. Al cambiar
  el proveedor de audiencia se invalidan y se reencola la sincronización.

## R3 · Resend dentro de la capa, sin regresión

- R3.1 Todo el código de Resend vive en `providers/resend`. El SDK `resend` no se importa en
  ningún otro sitio.
- R3.2 Mismas llamadas, mismo limitador de 110 ms entre peticiones y mismos errores fatales
  `missing_api_key`, `invalid_api_key` y `restricted_api_key`.
- R3.3 Las pruebas de secuencias, newsletter, sincronización, rutas de marketing y hub siguen
  pasando con el mismo comportamiento esperado. Solo cambian imports y nombres.
- R3.4 La ruta `POST /resend/webhook` del hub sigue activa con la misma firma y los mismos
  estados. El formato de cable entre app y hub no cambia.
- R3.5 En las fases 1 y 2 no hay migraciones de base de datos. La cola `resend_outbox`, las
  columnas `segment_id` y `broadcast_id` y la clave `resendApiKey` guardada siguen valiendo.
- R3.6 En el servicio cloud, `Mailer` y `NoMailer` siguen siendo el puerto del dominio. Las
  invitaciones siguen saliendo por Resend. La plantilla de la invitación sale del adaptador.

## R4 · Errores y reintentos

- R4.1 Un solo tipo `EmailProviderError` con `code`, `status`, `provider` y `kind`, donde `kind` es
  `fatal`, `retryable` o `rejected`.
- R4.2 Cada adaptador clasifica sus errores. Ningún consumidor mira códigos propios de un
  proveedor.
- R4.3 Un error fatal corta el drenaje de la cola, como hoy. Un error reintentable sigue el
  backoff actual de 1, 5, 30 minutos y 2 horas.

## R5 · Eventos de entrega

- R5.1 Cada proveedor traduce sus eventos a `DeliveryEvent` con los tipos `unsubscribed`,
  `bounced`, `complained`, `replied` y `delivered`.
- R5.2 Un proveedor entrega eventos por push, con webhook firmado, o por pull, consultando con un
  cursor. Resend es push. Apollo es pull salvo que el spike demuestre otra cosa.
- R5.3 Baja, rebote permanente y queja son supresión global. Un contacto suprimido por un
  proveedor no recibe nada por ningún otro.
- R5.4 Un rebote temporal no suprime, como hoy.

## R6 · Configuración

- R6.1 Las credenciales de cada proveedor se guardan en ajustes como la clave de Resend actual.
  Nunca se devuelven completas, solo un hint.
- R6.2 Cada proveedor tiene un botón «Probar» que ejecuta su `test()` y muestra el resultado.
- R6.3 Remitente y «responder a» son neutrales al proveedor. Un proveedor que envía desde un buzón
  conectado ignora `from` y lo declara en su política.
- R6.4 Ajustes lista los proveedores disponibles, su estado y los roles que cubren.
- R6.5 Las nuevas claves entran en la lista `NEVER_SYNC.settings` de `src/shared/edition.ts` para que no
  viajen en la sincronización.

## R7 · Apollo para outreach en frío

- R7.1 Apollo declara las capacidades `audience`, `sequences` y `events` por pull. No declara
  `send`, `broadcasts` ni disparo por evento.
- R7.2 Se autentica con la clave API maestra de Apollo, que su endpoint de inscripción exige.
- R7.3 Un contacto debe existir en Apollo antes de inscribirse. Las etiquetas de Apollo hacen de
  grupos.
- R7.4 Las secuencias se crean siempre inactivas. Activar una exige confirmación explícita de la
  persona, desde la app o desde Claude.
- R7.5 La inscripción respeta un tope diario configurable y los buzones conectados. Las
  inscripciones salen goteadas por la cola, nunca en bloque.
- R7.6 Cada correo en frío lleva enlace de baja y dirección física del remitente. Una respuesta de
  baja se procesa como supresión.
- R7.7 Las respuestas se consultan cada pocos minutos y se clasifican: quiere reunión, pregunta,
  referido, no interesado, fuera de oficina, baja.
- R7.8 Una respuesta de interés crea una tarea para el dueño y puede pasar el contacto al pipeline.
- R7.9 Antes de construir el adaptador, un spike confirma qué permite la API pública con el plan
  Basic. Lo que no se pueda hacer por API queda como acción manual declarada, no como promesa.

## R8 · Elegibilidad de destinatarios

- R8.1 Una función pura `canReceive(role, recipient)` decide si se puede enviar. Marketing exige
  estado `subscribed`. Outreach exige email válido y que no esté suprimido. Transaccional siempre
  puede.
- R8.2 Outreach nunca llega a un contacto en estado `unsubscribed`, `bounced` o `complained`.
- R8.3 El modelo de consentimiento para contactos fríos queda como decisión abierta del dueño
  antes de la fase 3.

## R9 · Extracción y crecimiento

- R9.1 Mover la carpeta a un paquete npm no exige cambiar ningún archivo dentro de ella.
- R9.2 Existe una guía de cuatro pasos para añadir un proveedor y una suite de pruebas de contrato
  que lo valida sin red.

## R10 · Calidad

- R10.1 Cada bloque termina con `npm run check` en cero errores.
- R10.2 Las pruebas viven en `src/test`. Fakes y ayudantes en `src/main/test`.
- R10.3 Código nuevo sin comentarios, salvo líneas eslint-disable.
- R10.4 Arquitectura limpia y SDD. Componentes de UI en diseño atómico y con props.

## Fuera de alcance

1. WhatsApp y SMS.
2. Implementar SES e Instantly. Solo queda la guía y el contrato para añadirlos.
3. Renombrar la tabla `resend_outbox`. Se anota como deuda en el diseño.
4. Bandeja de respuestas completa. En la fase 3 solo hay tareas y estados.
5. Entregabilidad: dominios secundarios, buzones y calentamiento se montan fuera del código.
