# Requisitos · A2 Tablero de tareas en Consultora

## Contexto

Las tareas viven en el menubar: una lista por día, máximo 8 tareas madre por día, subtareas,
descripción, tags y esfuerzo. Una tarea solo puede estar hecha o pendiente y no se relaciona con
clientes ni proyectos. Desde Consultora no se ven. El dueño quiere ver y gestionar sus tareas desde
Consultora para seguir el trabajo y llegar rápido a lo pendiente.

## Decisiones

1. El menubar no cambia de comportamiento: el día, el techo de 8, arrastrar y la revisión del día
   siguen igual.
2. Se añade un estado de trabajo: Pendiente, En curso y Hecha. `done` sigue existiendo y se
   mantiene igual a «Hecha», así el menubar, el historial y las herramientas MCP no se rompen.
3. Una tarea puede relacionarse con un cliente, un proyecto o un prospecto, de forma opcional.

## R1 · Sección Tareas

- R1.1 Nueva sección «Tareas» en la barra lateral, debajo de Workspace.
- R1.2 Dos vistas: Tablero y Lista. La vista elegida se recuerda, según A1.
- R1.3 La ruta de la franja muestra «Tareas» y, con una tarea abierta, su título.

## R2 · Tablero

- R2.1 Tres columnas: Pendiente, En curso y Hecha, con su contador.
- R2.2 Cada tarjeta muestra el título, el día, el esfuerzo, los tags, el avance de subtareas y el
  cliente o proyecto. Una tarea de un día pasado sin terminar se marca como atrasada.
- R2.3 Arrastrar una tarjeta a otra columna cambia su estado. Soltar en Hecha la completa con su
  fecha de cierre; sacarla de Hecha la reabre.
- R2.4 Las subtareas no son tarjetas aparte; se ven como avance en la tarjeta madre.
- R2.5 Dentro de una columna el orden es por día y luego por la posición del día.
- R2.6 La columna Hecha muestra solo lo cerrado en el periodo elegido, por defecto esta semana.

## R3 · Lista

- R3.1 Tabla como las de Obsidian Bases: título, estado, día, esfuerzo, tags, relación y avance.
- R3.2 Ordenar por cualquier columna. Cambiar el estado desde la propia fila.

## R4 · Filtros

- R4.1 Periodo: Hoy, Esta semana, Atrasadas, Próximas, Todas las abiertas o un rango de fechas.
- R4.2 Texto, tags, esfuerzo, cliente y proyecto. Contador de filtros activos como en Contactos.
- R4.3 Los filtros se recuerdan, según A1.

## R5 · Crear y editar

- R5.1 «Nueva tarea» pide título y día, por defecto hoy. Si el día ya tiene 8 tareas, el aviso es el
  mismo del menubar y ofrece el día siguiente libre.
- R5.2 «+» en una columna crea la tarea con ese estado.
- R5.3 Abrir una tarea muestra su detalle en un panel a la derecha, con el mismo editor del menubar:
  descripción, subtareas, tags, esfuerzo, día y, nuevo, estado y relación.
- R5.4 La ficha de cliente, proyecto y prospecto gana una sección «Tareas» con las suyas.

## R6 · En vivo

- R6.1 Lo que cambia en el menubar, en otra pantalla o desde Claude aparece en el tablero sin
  recargar.

## R7 · Claude

- R7.1 Las herramientas MCP de tareas aceptan y devuelven estado y relación.
- R7.2 Nueva herramienta `list_tasks` con los mismos filtros del tablero.
