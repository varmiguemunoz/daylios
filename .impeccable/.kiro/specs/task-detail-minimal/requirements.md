# Requisitos · Detalle de tarea minimalista

## Contexto

El detalle de una tarea hace ruido. Hay un selector Escribir y Ver, un bloque de esfuerzo, tags y
subtareas que ocupa media pantalla, y la descripción, que es lo importante, queda abajo.
El dueño quiere ver solo el título y la descripción, editar sin botones, y ver las subtareas
desde la lista de Hoy sin entrar a la tarea.

Decisiones: el editor sin modos es compartido, así que también aplica a Notas y Documentos.
Esfuerzo, tags y subtareas pasan a un panel lateral. Ningún cambio en main, API ni MCP.

## R1 · Editor sin modos

- R1.1 Desaparece el selector Escribir y Ver. El texto se muestra siempre en lectura.
- R1.2 Doble clic sobre el texto entra en edición. ⌘E y Enter con la lectura enfocada también entran.
- R1.3 Si no hay texto, se ve una pista discreta y un solo clic ya entra en edición.
- R1.4 Sale de edición a lectura cuando:
  - R1.4.1 se hace clic fuera del campo, al perder el foco;
  - R1.4.2 pasan 2 segundos sin escribir, contados desde la última tecla;
  - R1.4.3 se pulsa Esc. Ese Esc no cierra la pantalla, el siguiente sí.
- R1.5 Entrar sin escribir no activa el temporizador. Solo sale por foco o Esc.
- R1.6 Al salir se guarda al momento, sin esperar al autoguardado.
- R1.7 Al volver a entrar, el cursor vuelve a donde estaba.
- R1.8 En lectura siguen funcionando con un clic las casillas `- [ ]` y los enlaces.
- R1.9 Sin etiqueta Guardado fija. Solo aparece Guardando mientras guarda y No se guardó si falla.

## R2 · Cabecera mínima

- R2.1 El detalle muestra: Atrás, título, una línea de fecha y de ayer, una línea de resumen y la
  descripción.
- R2.2 La línea de resumen usa las mismas piezas que la fila de Hoy: barras de esfuerzo, chips de
  tags y avance de subtareas. Si no hay nada, se lee Añadir esfuerzo, tags o subtareas.
- R2.3 Clic en la línea de resumen, o en el botón Detalles de la cabecera, abre el panel lateral.
- R2.4 La cabecera queda con Atrás a la izquierda y Detalles y Borrar a la derecha.

## R3 · Panel lateral de detalles

- R3.1 Panel derecho sobre la pantalla, con el mismo Drawer de Consultora adaptado a 400px de ancho.
- R3.2 Contiene, en este orden: Esfuerzo, Tags y Subtareas.
- R3.3 Subtareas funciona igual que hoy: captura con `#tag` y `!alto`, ordenar arrastrando o con
  ⌥↑ y ⌥↓, completar, borrar con Deshacer y Completar las N pendientes.
- R3.4 Abrir una subtarea cierra el panel y navega a su detalle.
- R3.5 En el detalle de una subtarea el panel muestra solo Esfuerzo y Tags.
- R3.6 Esc, clic fuera o la X cierran el panel. Los cambios se ven al momento en la línea de resumen.
- R3.7 ⌘I abre y cierra el panel.

## R4 · Subtareas en la lista de Hoy

- R4.1 En una tarea con subtareas, el avance `2/5` de la fila se convierte en un botón con flecha
  que despliega las subtareas debajo de la madre.
- R4.2 Las subtareas desplegadas usan la fila compacta, con sangría a la altura del texto de la madre.
- R4.3 Desde ahí se puede: completar con el círculo o Espacio, abrir con clic o Enter, borrar con ⌫
  y Deshacer, y ordenar arrastrando o con ⌥↑ y ⌥↓.
- R4.4 Completar una subtarea actualiza el `2/5` de la madre al momento.
- R4.5 Teclado: → despliega la madre enfocada, ← la pliega. ← en una subtarea vuelve el foco a
  su madre. ↑ y ↓ recorren madres y subtareas visibles en orden.
- R4.6 Plegado por defecto. Lo desplegado se recuerda por tarea entre aperturas del menubar.
- R4.7 Arrastrar una madre no se mezcla con arrastrar subtareas. Las subtareas no salen de su madre.
- R4.8 El medidor de 8 y el techo siguen contando solo madres.

## Fuera de alcance

- Desplegar subtareas en Historial.
- Crear subtareas desde la lista de Hoy. Se crean en el panel.
- Cambios de datos, migraciones, API o herramientas MCP.
