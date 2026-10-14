# Requisitos · N3 Sincronización de datos en la nube

## Contexto

Con organizaciones, los registros deben llegar a todos sus miembros en tiempo real y seguir
funcionando sin conexión. La base local sigue siendo SQLite: la interfaz, Claude y la API local
leen y escriben siempre en local, y la sincronización trabaja por detrás. Depende de N0, N1, N2 y
ADR-02. Los archivos son N4.

## R1 · Activar y desactivar

- R1.1 Al crear una organización se elige: empezar vacía o llevar los datos de la edición Local. Se
  muestra cuánto se va a subir antes de confirmar.
- R1.2 Al unirse a una organización se descarga su información con una barra de progreso; se puede
  usar la app mientras termina.
- R1.3 Pausar la sincronización desde la franja o Ajustes. Los cambios se guardan y se envían al
  reanudar.
- R1.4 Con la edición Local no hay ningún proceso de sincronización.

## R2 · Tiempo real

- R2.1 Un cambio de un miembro aparece en los demás en menos de 2 segundos con buena conexión.
- R2.2 Las pantallas abiertas se actualizan solas, sin perder lo que se está escribiendo.
- R2.3 Aplica a clientes, proyectos, reuniones con resumen y action items, prospectos y etapas,
  pipelines, contactos, tags, reglas, fuentes sin secretos, secuencias, newsletters, tareas y
  subtareas, relaciones de notas, índice del workspace y dashboards.

## R3 · Sin conexión

- R3.1 Sin red todo sigue funcionando en local. Los cambios esperan en cola y se envían al volver.
- R3.2 Si la app se cierra con cambios en cola, se envían al abrir.

## R4 · Conflictos

- R4.1 Dos personas cambian campos distintos del mismo registro: se conservan los dos cambios.
- R4.2 Dos personas cambian el mismo campo: gana el último cambio según el reloj de la
  sincronización, y queda registrado en la actividad quién lo sobrescribió.
- R4.3 Un registro borrado por alguien mientras otro lo editaba queda borrado; quien editaba ve un
  aviso con la opción de restaurarlo.
- R4.4 El orden de tarjetas y tareas no se rompe cuando dos personas reordenan a la vez.
- R4.5 El techo de 8 tareas por día se respeta por persona responsable.

## R5 · Estado visible

- R5.1 Indicador en la franja: sincronizado, sincronizando, sin conexión, pausado o error, con el
  detalle al hacer clic: cambios en cola, último envío y el error en lenguaje claro.
- R5.2 «Sincronizar ahora» y «Volver a descargar todo» para casos raros.

## R6 · Seguridad

- R6.1 El servidor acepta cambios solo de miembros con permiso de edición y solo para su
  organización.
- R6.2 Cada cambio lleva un id único; enviarlo dos veces no lo aplica dos veces.
- R6.3 Los secretos nunca salen del dispositivo, según la lista de N0.

## R7 · Integraciones

- R7.1 El email marketing con Resend y el hub de leads siguen funcionando en el dispositivo que los
  tiene configurados. Los contactos y eventos que generan se sincronizan como cualquier dato.
