# Requisitos · MCP con cobertura total

## Contexto

Claude (Cowork) es el cerebro de DayliOS. Hoy tiene 50 herramientas, pero hay cosas que la UI hace y
Claude no (reordenar tareas, borrar contactos, editar fuentes, reprocesar reuniones…), y los módulos
1 a 7 añaden más. Regla: **todo lo que se puede hacer en la UI, Claude lo puede hacer por MCP**, con
las mismas validaciones (siempre a través de la API local).

## R1 · Cobertura

- R1.1 Cada capacidad de la UI tiene herramienta MCP (matriz en `design.md`).
- R1.2 Excepciones deliberadas: claves y secretos (OpenAI, Resend, token del hub), permisos de macOS
  y empezar/detener una grabación en vivo (necesita la pantalla). Se documentan.

## R2 · Convenciones

- R2.1 Nombres `list_*`, `get_*`, `save_*` (crear o editar, sin `id` crea), `delete_*` y verbos
  (`move_*`, `link_*`, `run_*`).
- R2.2 Referencias aceptan id o nombre donde la API ya lo hace (`ref`).
- R2.3 Herramientas destructivas exigen `confirm: true`; sin él devuelven qué se borraría.
- R2.4 Descripciones en español, con ejemplo de uso cuando el JSON es complejo.
- R2.5 El servidor declara `instructions` (guía corta: refs, confirmación, catálogo de automatizaciones
  antes de crear una).

## R3 · Calidad

- R3.1 Un archivo por dominio (foundations). Esquemas zod reutilizables (`ref`, `day`, `tags`,
  `confirm`).
- R3.2 Errores de la API se devuelven tal cual (mensajes de `AppError` en español).
- R3.3 README con la lista final de herramientas.
