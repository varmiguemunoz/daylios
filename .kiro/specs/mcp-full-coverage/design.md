# Diseño · MCP con cobertura total

## Matriz (estado final)

Leyenda: ✓ existe · + nueva · ~ cambia · − se elimina

| Dominio        | Herramientas                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Día y tareas   | ✓ get_day ~(progreso subtareas) · ✓ get_history ~ · ✓ create_task ~(`parent`) · ✓ update_task · ✓ delete_task · ✓ move_task ~ · ✓ carry_over_pending · + get_task · + reorder_tasks · + reorder_subtasks · + complete_subtasks |
| Notas          | ✓ list_notes · ✓ get_note ~(relaciones) · ✓ create_note ~(links) · ✓ update_note · ✓ delete_note · + search_notes · + link_notes · + unlink_notes · + link_note_client · + unlink_note_client |
| Clientes       | ✓ list_clients · ✓ get_client ~(notas) · ✓ save_client · + get_client_impact · + delete_client · ✓ get_project · ✓ save_project · + delete_project |
| Documentos     | ✓ list_documents · ✓ read_document · + write_document · + rename_document · + delete_document  |
| Reuniones      | ✓ list_meetings · ✓ get_meeting · ✓ create_meeting · ✓ update_meeting · ✓ update_action_item · ✓ list_action_items · ✓ import_recording · + process_meeting · + delete_meeting |
| Pipelines      | + list_pipelines · ✓ get_pipeline ~(`pipeline`) · + save_pipeline · + delete_pipeline · ✓ get_prospect · ✓ save_prospect ~ · ✓ move_prospect ~ · + delete_prospect |
| Contactos      | ✓ list_contacts ~(`tags[]`, `client`, `in_pipeline`) · ✓ get_contact ~(runs, pipeline) · ✓ save_contact ~(`project`) · + delete_contact · ✓ tag_contact · ✓ set_contact_subscription · + convert_contact · ✓ promote_contact (alias) · + detach_contact_prospect |
| Tags           | ✓ list_tags ~(`kind`) · + rename_tag · + set_tag_audience · + delete_tag · + rename_task_tag · + delete_task_tag |
| Fuentes        | ✓ list_sources · + save_source · + rotate_source_secret · + delete_source                       |
| Email          | ✓ list_sequences · + get_sequence · ✓ save_sequence · ✓ set_sequence_status · ✓ get_newsletter_context · ✓ send_newsletter · ✓ list_newsletters · + get_newsletter · + get_marketing_status · + sync_marketing_now |
| Automatización | + list_automation_catalog · + list_automations · + get_automation · + save_automation · + set_automation_status · + delete_automation · + test_automation · + run_automation · + list_automation_runs · + cancel_automation_run |
| Reglas         | − list_rules · − save_rule · − delete_rule                                                    |
| Contexto       | ✓ get_overview ~(por pipeline) · ✓ search · ✓ append_note                                      |

Total: 50 hoy → ~100 al final.

## Piezas comunes (`src/mcp/client.ts`)

```ts
export const ref = z.string().min(1).describe('id o nombre')
export const confirm = z.literal(true).optional().describe('true para ejecutar; sin él, solo muestra el impacto')
export const tags = z.array(z.string()).max(20)
export async function destructive(preview: () => Promise<unknown>, run: () => Promise<unknown>, ok?: true)
```

`destructive`: sin `confirm` llama al endpoint de impacto (o al `get`) y devuelve
`{ needsConfirm: true, impact }`; con `confirm` ejecuta.

## Rutas HTTP que faltan (además de las de cada módulo)

`POST /reorder` (tareas del día) · `DELETE /consultora/meetings/:id` (ya existe en servicio) ·
`POST /marketing/sources`, `PATCH /marketing/sources/:slug`, `POST /marketing/sources/:slug/rotate`,
`DELETE /marketing/sources/:slug` · `POST /marketing/sync` · `GET /marketing/status` (existe).

## `instructions` del servidor

«DayliOS es el sistema operativo de Miguel: día (máx. 8 tareas, subtareas sin límite), notas,
clientes, pipeline, contactos y automatizaciones. Las referencias aceptan id o nombre. Las
herramientas que borran piden `confirm: true`; llama primero sin él para ver el impacto. Antes de
crear una automatización, lee `list_automation_catalog`. El email de marketing solo llega a contactos
suscritos.»
