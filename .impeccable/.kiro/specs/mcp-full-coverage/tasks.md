# Tareas · MCP con cobertura total

Las herramientas de cada módulo se hacen en su módulo. Aquí queda lo transversal y lo que no tiene
módulo propio.

- [x] 1. `client.ts`: `ref`, `confirm`, `tags`, `destructive()`; `instructions` en `McpServer`
- [x] 2. Rutas y herramientas sin módulo: `reorder_tasks`, `process_meeting`, `delete_meeting`,
      `save_source`, `rotate_source_secret`, `delete_source`, `get_sequence`, `get_newsletter`,
      `get_marketing_status`, `sync_marketing_now`
- [x] 3. Revisión final: recorrer cada pantalla y cada acción de la UI contra la matriz; completar
      lo que falte
- [x] 4. Descripciones: revisar que todas digan qué hacen, qué devuelven y ejemplo si el JSON es
      complejo
- [x] 5. README: tabla final de herramientas por dominio y excepciones deliberadas

## Checklist

- [ ] Claude, en una conversación: crea un contacto, le pone 2 tags, lo convierte en prospecto en
      «Outbound», crea una automatización para la etapa «Contract Sent», la prueba con ese contacto
      y la activa
- [ ] `delete_contact` sin `confirm` devuelve el impacto y no borra
- [ ] `list_rules` ya no existe; `list_automations` sí
