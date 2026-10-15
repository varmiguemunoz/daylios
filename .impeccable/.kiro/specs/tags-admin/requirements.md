# Requisitos · Administración de tags

## Contexto

Los tags crecen solos (cada fuente crea `origen-*`, cada lead trae los suyos, cada tarea los suyos) y
aparecen en filtros y desplegables de Contactos, Pipeline y Automatizaciones. No hay dónde verlos
todos ni borrarlos. Además cada tag de contacto crea un Segment en Resend, y el plan de Resend tiene
tope de segments: con 4 tags ya falló la sincronización («Your plan includes 3 segments»).

## R1 · Pantalla Tags

- R1.1 Nueva pantalla «Tags» en la barra lateral de Consultora (sección principal, bajo Pipeline).
- R1.2 Dos secciones: **Contactos** y **Tareas**. Buscador común arriba.
- R1.3 Cada tag de contacto muestra nombre, slug, contactos, suscritos y si es audiencia.
- R1.4 Cada tag de tarea muestra el nombre y en cuántas tareas (incluidas subtareas) está.
- R1.5 Orden: más usados primero; los que tienen 0 usos aparecen con «Sin uso».

## R2 · Renombrar

- R2.1 Tag de contacto: cambia el nombre visible; el slug no cambia (secuencias, eventos y segments
  dependen de él).
- R2.2 Tag de tarea: cambia el texto en todas las tareas. Si el nombre nuevo ya existe, se fusionan.

## R3 · Eliminar

- R3.1 Borrar en dos pasos («¿Borrar?»).
- R3.2 Tag de contacto: se quita de todos los contactos, de los tags por defecto de las fuentes y se
  borra su Segment en Resend si lo tiene. No dispara automatizaciones de «tag quitado» (es limpieza).
- R3.3 Si una regla activa usa el tag (disparador o acción) no se borra: se muestra la lista de
  reglas para cambiarlas o pausarlas (con el módulo 7 aplicará a automatizaciones).
- R3.4 Tag de tarea: se quita de todas las tareas y subtareas.
- R3.5 El historial de eventos del contacto conserva las entradas antiguas (texto plano).

## R4 · Audiencias (segments de Resend)

- R4.1 Un tag de contacto es **audiencia** solo si se marca. Solo los tags audiencia tienen Segment
  en Resend.
- R4.2 El newsletter solo puede enviarse a tags audiencia.
- R4.3 Al marcar un tag como audiencia se crea su Segment y se sincronizan sus suscritos; al
  desmarcarlo se borra el Segment.
- R4.4 Migración: los tags que ya tienen Segment quedan como audiencia.
- R4.5 Los eventos `tag.<slug>` (secuencias) no dependen de la audiencia: siguen funcionando para
  cualquier tag.

## R5 · Desplegables y filtros

- R5.1 Todos los selectores de tags (filtros de Contactos y Pipeline, editor de tags, pasos de
  automatización) leen la misma lista y se refrescan tras renombrar o borrar.

## R6 · Claude (MCP)

- R6.1 `list_tags` con tipo (`contact` | `task`) y uso; `rename_tag`; `delete_tag` (con `confirm`);
  `set_tag_audience`; `rename_task_tag`; `delete_task_tag`.
