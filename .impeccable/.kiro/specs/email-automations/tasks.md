# Tareas

## Fase 0 · Cuentas (las hace el dueño)

- [ ] 0.1 Plan pago de Resend activo y dominio de envío verificado (SPF, DKIM, DMARC)
- [ ] 0.2 Cuenta de Cloudflare: desplegar `workers/leads-hub` (ver su README)
- [ ] 0.3 Webhook de Resend apuntando a `<worker>/resend/webhook` con los eventos
      `contact.updated`, `email.bounced`, `email.complained`
- [ ] 0.4 Tarea programada en Claude Cowork para el newsletter (prompt en el README)

## Fase 1 · Base

- [x] 1. Spec, Vitest dentro de Electron, base en memoria con migraciones, PRODUCT.md
- [x] 2. Contactos con marketing: migración `AddMarketing`, tags, línea de tiempo, suscripción,
      pasar a pipeline; rutas, IPC, preload y MCP
- [x] 3. UI Contactos (impeccable): filtros por tag, estado y fuente; ficha con tags y línea de tiempo

## Fase 2 · Resend y Worker

- [x] 4. `ResendGateway`, ajustes «Email (Resend)», outbox con reintentos, `marketing-sync`
- [x] 5. Worker `leads-hub`: `/in/:source`, cola D1, admin; tests
- [x] 6. Fuentes en la app + pull/ack del hub + push de config; pantalla Fuentes y ajustes «Hub»
- [x] 7. Reglas por tag: motor compartido, Worker y app; pantalla Reglas; MCP
- [x] 8. Estados desde webhooks de Resend (baja, rebote, queja)

## Fase 3 · Envíos

- [x] 9. Secuencias: listar, crear desde Claude (templates + automation), activar o pausar
- [x] 10. Newsletter automático con salvaguardas; pantalla Newsletters; MCP

## Fase 4 · Cierre

- [x] 11. README (Resend, despliegue del Worker, herramientas MCP), prompt para Claude Cowork,
      DESIGN.md

## Checklist de punta a punta (con cuentas reales)

- [ ] Ajustes → Email: «Probar» en verde; Ajustes → Hub: «Probar conexión» en verde
- [ ] Crear la fuente «Web» y enviar el `curl` de su tarjeta: el lead aparece en Contactos en menos
      de 1 min, suscrito, con `origen-web`, y en Resend dentro del Segment `tag:origen-web`
- [ ] Regla «cuando entra webinar → añadir nurture»: un lead con `tags: ["webinar"]` llega con ambos
- [ ] Claude: `save_sequence` para `tag.webinar` y `set_sequence_status` activa; un lead nuevo con
      ese tag recibe el primer email
- [ ] Claude: `send_newsletter` a un tag de prueba; llega la copia y luego el newsletter; un segundo
      intento el mismo día devuelve error
- [ ] Clic en «Darse de baja» del email: el contacto pasa a «Baja» en la app
