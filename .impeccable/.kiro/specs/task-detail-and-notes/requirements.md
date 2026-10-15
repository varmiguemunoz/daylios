# Requisitos · Detalle de tarea + Notas

## Contexto

DayliOS ya gestiona el día (techo 8) con Hoy e Historial. Esta iteración añade dos cosas:
abrir una tarea para verla y escribir su descripción, y un sistema de notas en markdown.
Todo sigue el mismo patrón del backend (Express + TypeORM + MVC) y del renderer (React, sin router).

## R1 · Detalle de tarea

- R1.1 Clic en una tarea (Hoy o Historial) abre la pantalla de detalle dentro de la misma ventana.
- R1.2 La pantalla tiene botón «Atrás» (y `Esc`) que vuelve a la vista de la que vino.
- R1.3 Se puede editar el título. El título admite markdown en línea: **negrita**, _cursiva_, ~~tachado~~, `código` y enlaces.
- R1.4 Se puede escribir una descripción en markdown completo (ver R3).
- R1.5 Se puede marcar hecha / pendiente y borrar desde el detalle.
- R1.6 Los cambios se guardan solos (sin botón Guardar), con indicador «Guardado».
- R1.7 La descripción es opcional y no cuenta para el techo de 8.

## R2 · Notas

- R2.1 Nueva pestaña «Notas» (`⌘3`) junto a Hoy e Historial.
- R2.2 Pantalla principal: todas las notas agrupadas por día, de la más reciente a la más antigua, con el mismo estilo y paginación que Historial.
- R2.3 Cada nota muestra su título (primera línea) y un extracto en una línea.
- R2.4 Botón «Nueva nota»: crea la nota y abre el editor. `⌘N` en la pestaña Notas hace lo mismo.
- R2.5 Clic en una nota abre el editor.
- R2.6 Editor: markdown completo, a pantalla completa, con botón «Atrás», modo Escribir / Ver (`⌘E`) y guardado automático.
- R2.7 Borrar una nota desde el editor. Una nota vacía al salir se borra sola.
- R2.8 Sin límite de cantidad de notas. Máximo 100 000 caracteres por nota.

## R3 · Markdown

- R3.1 Soporta GFM: títulos, párrafos, listas, listas de tareas `- [ ]`, citas, código en línea y en bloque, tablas, tachado, enlaces, separadores, autoenlaces.
- R3.2 Sin HTML crudo (seguro por defecto). Los enlaces se abren en el navegador del sistema.
- R3.3 Estilos propios según DESIGN.md (pastel sobre noche, Nunito, radios generosos, One Meaning Rule).
- R3.4 Un solo componente de markdown reutilizado en tareas y notas.

## R4 · Claude (MCP)

- R4.1 `get_day` / `get_history` devuelven la descripción de cada tarea.
- R4.2 `create_task` y `update_task` aceptan `description`.
- R4.3 Herramientas de notas: `list_notes`, `get_note`, `create_note`, `update_note`, `delete_note`.

## R5 · Calidad

- R5.1 Mismas capas que el servidor actual: modelo, vista, controlador, rutas, servicio, guard de transacciones.
- R5.2 Sin router, sin gestor de estado, sin editor WYSIWYG: `textarea` + vista previa.
- R5.3 Sin tests (decisión del dueño). Verificación manual del dueño.
- R5.4 Bases existentes se migran sin perder datos.

## Fuera de alcance

Búsqueda de notas, etiquetas, carpetas, adjuntos/imágenes locales, resaltado de sintaxis, marcar casillas `- [ ]` desde la vista previa, sincronización.
