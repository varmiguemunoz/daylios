# Requisitos · Automatizaciones

Reemplaza la pestaña **Reglas** y sustituye al spec aplazado `internal-automations`. La base es la
investigación `research-ghl.md`: cada decisión cita su hallazgo, por ejemplo [GHL 6.2].

## Contexto

Las Reglas tienen un solo disparador, que es un tag, cuatro acciones y nada en el tiempo. El dueño
quiere automatizar los flujos internos de DayliOS como en GoHighLevel:

- un lienzo con triggers y pasos;
- ramas con condiciones y esperas;
- un registro de cada ejecución;
- poder añadir tipos de nodo nuevos sin tocar el motor.

## Glosario

- **Automatización.** Una definición con nombre, tipo de sujeto, estado, ajustes, triggers y un
  árbol de nodos.
- **Sujeto.** La entidad que recorre la automatización: contacto, prospecto, cliente, tarea,
  reunión, o ninguno en las programadas [GHL 2.4].
- **Trigger.** Una suscripción a un evento interno con filtros. Hay varios por automatización y
  basta con que uno se cumpla [GHL 2.1].
- **Nodo.** Un paso del árbol. Puede ser de dominio, que toca datos, o de control: condición,
  espera, ir a o finalizar [GHL 3.1].
- **Puerto.** Una salida con nombre de un nodo. Las acciones tienen `next`, If/Else tiene una por
  rama más `none`, y las esperas con timeout tienen `met` y `timeout`.
- **Ejecución.** Una inscripción de un sujeto en una versión publicada [GHL 6.2].
- **Paso.** El registro de lo que hizo un nodo dentro de una ejecución [GHL 10.1].

## R1 · Definición

- R1.1 Una automatización tiene:
  - nombre;
  - tipo de sujeto;
  - estado `draft | active | paused | locked`;
  - ajustes;
  - uno o más triggers;
  - un árbol de nodos con raíz.
- R1.2 Una automatización nueva nace en `draft` y no inscribe a nadie hasta activarse [GHL 6.3].
- R1.3 Todos los triggers de una automatización comparten el tipo de sujeto. El sujeto limita qué
  nodos se pueden usar.
- R1.4 El árbol no tiene uniones: cada nodo tiene un solo padre. «Ir a» es el único salto, solo
  como último nodo de una rama, y solo hacia un nodo anterior en el camino [GHL 4.1].
- R1.5 Ajustes:
  - `reentry`: `allow` por defecto [GHL 6.1], o `never`;
  - `window`: ventana horaria para nodos de comunicación, apagada por defecto [GHL 8.2].

## R2 · Borrador, publicación y versiones

- R2.1 El editor trabaja sobre un **borrador** que se guarda solo y no crea versión [GHL 7.1].
- R2.2 **Publicar** valida el borrador. Si tiene cero errores, crea una versión numerada e
  inmutable y la deja como versión vigente.
- R2.3 Cada ejecución queda fijada a la versión con la que entró. Publicar una versión nueva no
  cambia las ejecuciones en curso [decisión, GHL 6.4].
- R2.4 Se guardan las últimas 10 versiones. Restaurar copia una versión al borrador.
- R2.5 Pausar deja de inscribir y congela las esperas. Reanudar continúa, y lo que venció corre
  marcado «con retraso» [GHL 6.3].
- R2.6 Borrar una automatización cancela sus ejecuciones abiertas y la manda a la papelera 30
  días.

## R3 · Triggers

| Clave                    | Sujeto    | Filtros                               |
| ------------------------ | --------- | ------------------------------------- |
| `contact.created`        | contacto  | fuente                                |
| `contact.tag_added`      | contacto  | tag                                   |
| `contact.tag_removed`    | contacto  | tag                                   |
| `contact.updated`        | contacto  | campo, opcionalmente valor nuevo      |
| `contact.subscribed`     | contacto  | ninguno                               |
| `contact.unsubscribed`   | contacto  | ninguno                               |
| `contact.bounced`        | contacto  | ninguno                               |
| `prospect.created`       | prospecto | pipeline                              |
| `prospect.stage_changed` | prospecto | pipeline, desde etapa, hacia etapa    |
| `prospect.won`           | prospecto | pipeline                              |
| `prospect.lost`          | prospecto | pipeline                              |
| `client.created`         | cliente   | ninguno                               |
| `task.completed`         | tarea     | tag de tarea                          |
| `meeting.ready`          | reunión   | cliente                               |
| `schedule`               | ninguno   | diario, semanal o mensual, a una hora |
| `manual`                 | cualquier | ninguno                               |

- R3.1 Además de sus filtros propios, todo trigger admite condiciones extra sobre el sujeto, con
  el mismo editor que If/Else [GHL 2.3].
- R3.2 `schedule` corre como máximo una vez por hora y no recupera ocurrencias pasadas
  [GHL 2.4].
- R3.3 Un disparo rechazado se registra con su motivo:
  - filtro no cumplido;
  - ya inscrito;
  - automatización pausada;
  - límite de bucle.

  Se ve en el registro del trigger [GHL 10.2].

- R3.4 Solo disparan los cambios hechos **en este equipo**. Los cambios que llegan por
  sincronización no disparan nada [decisión, ver D4].

## R4 · Nodos de control

- R4.1 **If/Else.** Tiene una o más ramas con nombre, reordenables. Cada rama es una lista de
  grupos unidos con AND u OR, y cada grupo es una lista de condiciones. Gana la primera rama que
  se cumple; si ninguna se cumple, sale por `none`, que siempre existe [GHL 5.1].
- R4.2 **Esperar.** Tres tipos:
  - durante N minutos, horas o días;
  - hasta una fecha y hora, fija o tomada de un campo del sujeto con desplazamiento;
  - hasta que se cumpla una condición, con timeout obligatorio y puertos `met` y `timeout`
    [GHL 8.1].
- R4.3 **Ir a.** Salta a un nodo anterior del mismo camino. Cuenta para el límite de bucles.
- R4.4 **Finalizar.** Termina la ejecución con estado `finished`.

## R5 · Nodos de dominio

Se reutiliza el catálogo de `internal-automations` R4:

- **Contacto:** añadir tag, quitar tag, actualizar dato, guardar campo, añadir a notas, asignar o
  quitar cliente, asignar proyecto, dar de baja de marketing y borrar.
- **Pipeline:** convertir en prospecto, mover, actualizar y borrar.
- **Clientes:** crear cliente y crear proyecto.
- **Email:** enviar email, iniciar secuencia de Resend y avisarme por email.
- **Productividad:** crear tarea, crear nota y notificación del Mac.
- **Integraciones:** webhook.

Reglas que aplican a todos:

- R5.1 Cada nodo declara si es `external`, si es `destructive`, si es de `communication` y qué
  sujeto necesita.
- R5.2 Un nodo que no aplica se **omite** con el motivo y la ejecución sigue: un contacto sin
  email, no suscrito o sin prospecto.
- R5.3 Una automatización con nodos destructivos exige confirmar «Entiendo que borra registros» al
  publicar.

## R6 · Variables y salidas

- R6.1 Variables del sujeto como en `internal-automations` R5. Se añade
  `{{trigger.<clave>}}` con los datos del evento.
- R6.2 Un nodo puede producir salidas, y los nodos siguientes las usan con
  `{{steps.<nodeId>.<clave>}}`. Por ejemplo, el webhook deja `status` y `body` [GHL 3.2].
- R6.3 El selector de variables solo ofrece las salidas de los nodos anteriores del mismo camino.
- R6.4 Una variable vacía se convierte en texto vacío y nunca lanza error.

## R7 · Ejecución

- R7.1 Si `reentry = never`, hay como máximo una ejecución por sujeto en toda la historia. Si es
  `allow`, puede haber varias, pero nunca dos abiertas a la vez [GHL 6.1].
- R7.2 Los nodos internos corren en una transacción por nodo. Si fallan, la ejecución queda
  `failed` con el motivo.
- R7.3 Los nodos externos corren fuera de transacción, con clave de idempotencia
  `runId:nodeId`.
  - Se reintentan 3 veces, a 1, 5 y 30 minutos, ante error de red, 429 o 5xx.
  - Ante un 4xx fallan de inmediato.
  - Agotados los intentos, quedan como `failed` con «límite de reintentos» [GHL 9.1].
- R7.4 La ejecución sobrevive al cierre de la app. Al abrir, lo vencido corre y se marca «con
  retraso».
- R7.5 Bucles:
  - Una cadena de causas puede tener como máximo 5 automatizaciones.
  - Una automatización no se vuelve a disparar por su propia acción dentro de la misma cadena.
  - Más de 20 inscripciones del mismo sujeto en 30 minutos pasa la automatización a `locked`, con
    aviso [GHL 6.5].
- R7.6 Las esperas por condición se vuelven a evaluar con cada evento del sujeto y al vencer el
  timeout.
- R7.7 La ventana horaria aplaza solo los nodos de comunicación hasta la siguiente apertura. Usa la
  zona horaria del sistema [GHL 8.2].

## R8 · Operación manual

- R8.1 Sobre una ejecución se puede:
  - cancelar;
  - reanudar ya, saltando la espera actual;
  - reintentar el paso fallido [GHL 6.2].
- R8.2 Sobre un nodo se pueden reintentar en bloque todas las ejecuciones fallidas en él.
- R8.3 Toda acción manual registra su origen: `user`, `claude` o `system` [GHL 7.2].
- R8.4 Ejecutar a mano sobre un sujeto, desde su ficha o desde Claude.
- R8.5 **Probar.** Simula sobre un sujeto real sin escribir nada y muestra paso a paso qué rama
  tomaría y qué haría cada nodo. Las esperas se dan por cumplidas.

## R9 · Registros

- R9.1 **Inscripciones.** Una fila por ejecución: sujeto, motivo, fecha de entrada, nodo actual,
  estado, próxima ejecución y acciones. Filtros por fecha y estado, y búsqueda por sujeto
  [GHL 10.2].
- R9.2 **Registro.** Una fila por paso: nodo, estado `ok | skipped | waiting | failed | retrying`,
  inicio, fin, intento, mensaje y salida. Filtro por nodo y estado.
- R9.3 **Estadísticas en el lienzo.** Cada nodo muestra cuántas ejecuciones pasaron por él, cuántas
  esperan y cuántas fallaron. Al abrir una ejecución se resalta su camino.
- R9.4 Las ejecuciones y sus pasos se guardan 60 días [GHL 10.2].
- R9.5 Una ejecución fallida genera una notificación del Mac y una insignia en Automatizaciones,
  como máximo una por automatización cada 24 h [GHL 9.2].

## R10 · Editor

- R10.1 Lienzo en árbol como el de GHL, con zoom, desplazamiento, ajustar a pantalla y minimapa.
  Las posiciones se calculan solas a partir del árbol y no se guardan [GHL 1.1].
- R10.2 Los triggers se ven arriba en paralelo y se unen en el primer nodo. Hay «+» entre cada par
  de nodos y al final de cada rama.
- R10.2.1 **Arrastrar y soltar.**
  - Se arrastra un nodo, o un nodo con todo lo que cuelga de él, a cualquier hueco «+» del árbol.
  - Mientras se arrastra, los huecos válidos se resaltan y los inválidos no aceptan.
  - Al soltar, el árbol se recalcula y se anima a su nueva forma [GHL 1.5].
  - Un nodo del catálogo también se puede arrastrar directo a un hueco.
- R10.2.2 Un movimiento es inválido si mete un nodo dentro de su propio subárbol, si deja un «Ir a»
  que ya no es último de su rama, si su destino queda debajo de él, o si deja un nodo incompatible
  con el sujeto.
- R10.2.3 Mover un If/Else mueve sus ramas. Al arrastrar solo el nodo, sin «con lo que cuelga»,
  el resto de su camino se queda en su lugar y se reconecta al padre. «Con lo que cuelga» se elige
  con la tecla Alt mientras se arrastra, y un aviso lo indica.
- R10.2.4 Copiar y pegar un nodo o un subárbol en un hueco, con ids nuevos.
- R10.3 El selector de nodos es un panel lateral con buscador por nombre y descripción, grupos
  plegables y favoritos. Los nodos que no aplican al sujeto se ven atenuados y con el motivo
  [GHL 1.2].
- R10.4 Clic en un nodo abre su panel con nombre editable, campos, «Guardar paso», «Cancelar» y
  «Borrar». Borrar un If/Else pide elegir qué rama conservar o borrar todas [GHL 1.3].
- R10.5 Los errores de validación se marcan en el nodo, y un contador global bloquea publicar
  [GHL 1.4].
- R10.6 Deshacer y rehacer dentro de la sesión del editor.
- R10.7 Pestañas: Lienzo, Ajustes, Inscripciones y Registro.

## R11 · Migración desde Reglas

- R11.1 Cada regla pasa a ser una automatización equivalente con el trigger `contact.tag_added` y
  nodos en cadena:
  - `add_tag` y `remove_tag` quedan igual;
  - `fire_event` pasa a «iniciar secuencia»;
  - `promote` pasa a «convertir en prospecto».

  Conserva el estado: activa pasa a `active` y pausada a `paused`.

- R11.2 La pestaña Reglas, su tabla, `runRules`, su servicio, su IPC y sus herramientas MCP
  desaparecen.
- R11.3 El Worker `leads-hub` deja de evaluar reglas, según `internal-automations` R9.2 y R9.3.

## R12 · Claude por MCP

- R12.1 Herramientas:
  - `list_automation_catalog`: triggers, condiciones y nodos con su esquema de campos;
  - `list_automations` y `get_automation`;
  - `save_automation_draft`;
  - `publish_automation`;
  - `set_automation_status`;
  - `delete_automation`;
  - `test_automation`;
  - `run_automation`;
  - `list_automation_runs`;
  - `get_automation_run`;
  - `cancel_automation_run`;
  - `retry_automation_run`.
- R12.2 Publicar o borrar desde Claude exige `confirm: true`.

## R13 · Extensibilidad

- R13.1 Añadir un tipo de nodo nuevo requiere exactamente dos cosas: su especificación en el
  registro compartido y su handler en el registro del motor. No toca el motor, el editor, la
  validación ni MCP.
- R13.2 Un test falla si un nodo del registro compartido no tiene handler, o al revés.
- R13.3 El contrato del handler admite cuatro resultados: seguir por un puerto, esperar hasta una
  fecha o hasta un evento, omitir y fallar. Con eso caben los nodos futuros: objetivo, split A/B,
  bucles y cálculos [GHL 3.3].

## Fuera de alcance de V1

- Varios puntos de entrada por trigger.
- Split A/B.
- Objetivo.
- Bucles.
- Esperas por ventana recurrente.
- Posiciones libres en el lienzo.
- Notas fijas.
- Migrar ejecuciones en curso a una versión nueva.
- Nodos de terceros.
