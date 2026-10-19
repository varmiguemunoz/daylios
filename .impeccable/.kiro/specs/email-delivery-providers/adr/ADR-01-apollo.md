# ADR-01 · Qué permite la API de Apollo

## Estado

Aceptada con verificaciones pendientes. Basada en la referencia pública de docs.apollo.io del 19 de octubre de 2026. Falta probar con la clave maestra real del plan Basic.

## Confirmado en la documentación

| Uso | Endpoint |
| --- | --- |
| Autenticación | cabecera `x-api-key` |
| Crear contacto | `POST /api/v1/contacts` con `email`, `first_name`, `last_name`, `label_names`, `run_dedupe`. 0 créditos |
| Buscar contactos | `POST /api/v1/contacts/search` con `q_keywords`. 0 créditos |
| Buscar secuencias | `POST /api/v1/emailer_campaigns/search`. Devuelve `emailer_campaigns` con `id`, `name`, `active`, `archived`, `created_at`, `num_steps` |
| Crear secuencia | `POST /api/v1/sequences` con `name`, `active`, `emailer_schedule_id` obligatorio y `emailer_steps` |
| Editar o pausar | `PUT /api/v1/sequences/{id}` con `name`, `active` y `emailer_steps` como diff declarativo |
| Desactivar | `POST /api/v1/emailer_campaigns/{id}/abort` |
| Inscribir | `POST /api/v1/emailer_campaigns/{id}/add_contact_ids` con `emailer_campaign_id`, `contact_ids[]`, `send_email_from_email_account_id`, `status`. Clave maestra. 0 créditos |
| Sacar o parar | `POST /api/v1/emailer_campaigns/remove_or_stop_contact_ids` con `mode` |
| Buzones | `GET /api/v1/email_accounts` |
| Mensajes | `GET /api/v1/emailer_messages/search` con filtros de fecha y clase de respuesta. Devuelve `to_email`, `status`, `replied`, `reply_class`, `completed_at` |

## Por verificar con la clave real

1. Que el plan Basic tenga acceso a la API y a la clave maestra.
2. `GET /api/v1/emailer_schedules` para elegir el horario por defecto. Si no existe, configurar el id a mano.
3. `GET /api/v1/emailer_campaigns/{id}` para el detalle con pasos.
4. Forma exacta de la respuesta al crear una secuencia y un contacto. El adaptador acepta `emailer_campaign`, `sequence` o el objeto plano, y `contact.id` o `id`.
5. Cómo acepta varios buzones en la query: el adaptador manda `send_email_from_email_account_id[]` cuando hay más de uno.
6. Valores exactos de `reply_class`. El adaptador detecta baja por el texto `unsub` e interés por `meet`, `question` o `referral`.
7. Si existe webhook de respuestas. Mientras tanto se consulta cada 5 minutos.
8. Límite real de envíos por día del plan Basic.

## Consecuencias

1. Las secuencias se pueden crear y editar desde Alisuite y desde Claude.
2. Si alguna verificación falla, el ajuste queda dentro de `providers/apollo` sin tocar consumidores.
