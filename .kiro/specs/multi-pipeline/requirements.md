# Requisitos · Pipelines (varios) y nueva UX

## Contexto

Hoy hay un solo pipeline; sus etapas se editan en Ajustes y el tablero solo tiene columnas. Referencia
del dueño: el tablero de Deals de Apollo (selector de pipeline, vista tablero o lista, columnas con
nombre y conteo, «Add deal» por columna). Quiere poder tener un pipeline por oferta, editarlo desde el
propio pipeline, filtrar en un panel lateral y moverse rápido en horizontal.

## R1 · Varios pipelines

- R1.1 Hay 1..n pipelines, cada uno con sus etapas (columnas). Al migrar, el actual pasa a llamarse
  «Ventas».
- R1.2 Selector de pipeline en la cabecera (aquí un desplegable sí tiene sentido: elegir uno de N).
  Opción «Nuevo pipeline» al final.
- R1.3 Se recuerda el último pipeline y la última vista usados.
- R1.4 Etapa «ganada» crea el cliente en cualquier pipeline (como hoy).

## R2 · Vistas

- R2.1 Control segmentado «Columnas | Lista».
- R2.2 Columnas: cabecera de columna con nombre, conteo y valor total; botón «+» en cada columna para
  crear un prospecto ahí (input en línea); tarjetas con empresa, valor, contacto principal y próximo
  paso (butter si vencido). Arrastrar entre columnas y dentro de una columna (como hoy).
- R2.3 Lista: tabla con Prospecto, Etapa, Valor, Contacto, Próximo paso, Fecha del paso, Actualizado.
  Clic en cabecera ordena. Clic en fila abre el prospecto. La etapa se cambia desde la fila (selector
  en línea).
- R2.4 Las dos vistas muestran el mismo conjunto filtrado.

## R3 · Panel de filtros (derecha)

- R3.1 Botón «Filtros» (con contador) abre el panel lateral: búsqueda (empresa, contacto, notas,
  próximo paso), tags de los contactos del prospecto, etapas (abiertas, ganadas, perdidas),
  «Próximo paso vencido», valor mínimo. «Limpiar filtros».
- R3.2 Nada de desplegables sin sentido en la cabecera: solo selector de pipeline, vista, Filtros,
  Editar y Nuevo.

## R4 · Editar pipeline (modal)

- R4.1 Botón visible «Editar pipeline» en la cabecera.
- R4.2 El modal permite: renombrar el pipeline, reordenar columnas (arrastrar), renombrar columnas,
  cambiar tipo (Abierta, Ganada, Perdida), añadir y eliminar columnas.
- R4.3 Eliminar una columna con prospectos pide a qué columna moverlos.
- R4.4 Eliminar el pipeline: si tiene prospectos, pide a qué pipeline y etapa moverlos. Debe quedar
  al menos un pipeline. Cada pipeline necesita al menos una etapa abierta.
- R4.5 Los cambios se guardan juntos con «Guardar»; «Cancelar» descarta.
- R4.6 El editor de etapas sale de Ajustes.

## R5 · Navegación horizontal

- R5.1 Teclado (cuando no se escribe): ← / → desplaza una columna; ⇧← / ⇧→ al inicio / al final.
- R5.2 Mantener pulsado el clic **500 ms** sobre el fondo del tablero (no sobre una tarjeta)
  activa el modo arrastre: el cursor cambia a mano y mover el ratón desplaza el tablero en horizontal
  (y vertical si hace falta). Soltar termina. Un indicador sutil avisa cuando se activa.
- R5.3 Arrastrar tarjetas, scroll del trackpad y la rueda siguen funcionando igual.

## R6 · Prospectos

- R6.1 Borrar un prospecto (ficha y menú de fila), en dos pasos. Sus contactos quedan sin prospecto;
  sus reuniones sin prospecto.
- R6.2 Mover un prospecto a otro pipeline desde su ficha (pipeline + etapa).

## R7 · Claude (MCP)

- R7.1 `list_pipelines`, `get_pipeline { pipeline? }`, `save_pipeline { id?, name, stages? }`,
  `delete_pipeline { pipeline, move_to?, confirm }`.
- R7.2 `save_prospect` y `move_prospect` aceptan `pipeline`; `delete_prospect { prospect, confirm }`.
- R7.3 `get_overview` agrupa el pipeline por pipeline.
