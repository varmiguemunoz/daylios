# Requisitos · Notas relacionadas y notas de clientes

## Contexto

Las notas viven sueltas por día. El dueño quiere enlazarlas entre sí (y con clientes) y ver, al
inicio y al final de cada nota, un índice de con qué está relacionada.

## R1 · Relacionar notas

- R1.1 Una nota puede relacionarse con 0..n notas. La relación es **bidireccional**: si A se relaciona
  con B, B muestra A.
- R1.2 No se puede relacionar una nota consigo misma ni duplicar una relación.
- R1.3 «Relacionar» abre un buscador de notas por título y texto (solo para elegir; no hay pantalla de
  búsqueda de notas).
- R1.4 Quitar una relación desde cualquiera de las dos notas.

## R2 · Índice en la nota

- R2.1 **Inicio**: bajo la cabecera, una línea «Relacionadas» con chips (título de cada nota y de
  cada cliente). Clic abre la nota o el cliente.
- R2.2 **Final**: tras el contenido, sección «Notas relacionadas» con título, fecha y extracto de cada
  una, y el botón «Relacionar».
- R2.3 Sin relaciones, el inicio no muestra nada y el final solo el botón «Relacionar».
- R2.4 Abrir una nota relacionada apila la navegación: «Atrás» vuelve a la nota anterior.

## R3 · Notas y clientes

- R3.1 Una nota puede relacionarse con 0..n clientes (desde la nota o desde el cliente).
- R3.2 Ficha del cliente: sección «Notas» con las notas relacionadas (más recientes primero), «Nueva
  nota» (crea una nota ya relacionada y la abre) y «Relacionar nota».
- R3.3 Las notas se abren dentro de la ventana Consultora con el mismo editor.
- R3.4 Borrar un cliente o una nota borra sus relaciones, no las notas.

## R4 · Claude (MCP)

- R4.1 `get_note` devuelve notas y clientes relacionados.
- R4.2 `search_notes`, `link_notes`, `unlink_notes`, `link_note_client`, `unlink_note_client`.
- R4.3 `get_client` incluye sus notas (título, fecha, id).
- R4.4 `create_note` acepta `related_notes` y `clients`.
