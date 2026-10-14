# Requisitos · A1 Persistencia de la interfaz

## Contexto

La interfaz principal es el popover del menubar: Hoy, Historial y Notas. Hoy pierde su estado
constantemente:

- Cambiar de pestaña desmonta la vista anterior. Al volver a Historial se pierden el periodo, el
  rango y la página; al volver a Notas, la página; en todas se pierde el scroll.
- Abrir una tarea o una nota y pulsar Atrás deja la lista arriba del todo.
- Lo escrito y no enviado en «Añade una tarea…» se pierde al cambiar de pestaña.
- Al reiniciar la app siempre se abre Hoy, aunque estuvieras en una nota.
- El popover se oculta al perder el foco. Para consultar algo y volver hay que reabrirlo cada vez.

Consultora tiene el mismo problema: siempre empieza en Clientes y no recuerda historial, filtros,
scroll ni tamaño de ventana.

Referencia: Obsidian guarda el estado de su espacio de trabajo en un archivo propio y al abrir
vuelve exactamente a como lo dejaste.

## Parte 1 · Menubar, la ventana principal

### R1 · Las pestañas no se reinician

- R1.1 Cada pestaña conserva su estado al cambiar a otra y volver: scroll, filtros, periodo, rango,
  página y lo escrito en los campos.
- R1.2 Volver de un detalle deja la lista en el mismo scroll y con la misma tarea a la vista.

### R2 · Volver a donde estaba

- R2.1 Al reabrir el popover se ve exactamente lo último: pestaña o detalle abierto, con su scroll.
- R2.2 Al reiniciar la app se restaura la última pantalla. Si era una tarea o nota que ya no existe,
  se abre su pestaña sin error.
- R2.3 El borrador de «Añade una tarea…» sobrevive a cerrar y reabrir el popover y al reinicio.

### R3 · Fijar la ventana

- R3.1 Botón «Fijar» en la ventana: fijada, no se oculta al perder el foco, se puede mover y cambiar
  de alto, como una ventana pequeña de Obsidian.
- R3.2 Fijada recuerda su posición y su alto. Al desfijar vuelve a colgarse del icono.
- R3.3 El estado de fijada se recuerda entre reinicios. Por defecto no está fijada.
- R3.4 Esc y clic en el icono siguen ocultándola también fijada.

### R4 · Lo que ya se recordaba

- R4.1 Las tareas madre desplegadas en Hoy pasan al almacén nuevo sin perderse.

## Parte 2 · Consultora

### R5 · Navegación

- R5.1 Al reabrir o reiniciar se abre la última pantalla con su historial de atrás y adelante, hasta
  50 pasos. Lo que ya no existe abre la lista de su sección.
- R5.2 Cada sección recuerda su última pantalla. Pulsar la sección en la que ya estás lleva a su
  lista.

### R6 · Ventana y vistas

- R6.1 Tamaño, posición, pantalla y maximizado. Si esa pantalla ya no está, se centra.
- R6.2 Filtros, búsqueda, orden, página y vista de cada lista; scroll por lista y por ficha.
- R6.3 Workspace: zoom y posición de cada board y scroll de cada nota.
- R6.4 Barra lateral, explorador, propiedades plegadas y categoría de Ajustes en el almacén nuevo.

## Parte 3 · Común

### R7 · Robustez

- R7.1 El estado vive en un archivo de la app, `ui-state.json`, no en `localStorage`. Sobrevive a
  borrar la caché y es el mismo en desarrollo y en producción.
- R7.2 Se guarda sin bloquear, como mucho medio segundo después del último cambio, y siempre al
  salir.
- R7.3 Archivo dañado o de otra versión: valores por defecto, sin fallar.
- R7.4 La primera vez se importan las claves que hoy viven en `localStorage`.
- R7.5 Es estado del dispositivo; con la nube activada no se sincroniza.
- R7.6 Ajustes de Consultora tiene «Restablecer el diseño de las ventanas».
