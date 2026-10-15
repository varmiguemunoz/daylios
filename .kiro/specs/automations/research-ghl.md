# Investigación · Motor de workflows de GoHighLevel

Fecha: 14 oct 2026. Objetivo: entender el comportamiento observable del motor de workflows de GHL
para diseñar el motor de Automatizaciones de DayliOS. Este documento no copia código de GHL; solo
registra conceptos, nombres de estados y comportamientos.

## Método y límites

Fuentes, de mayor a menor autoridad:

- **D · Documentación pública oficial.** help.gohighlevel.com, marketplace.gohighlevel.com/docs,
  ideas.gohighlevel.com. URL en cada hallazgo.
- **O · Observación con REA.** Chrome con perfil aparte en el puerto CDP 9222, sesión iniciada por el
  dueño, workflow `IUL FOLLOW UP` en Draft. Capturas de pantalla `s15` a `s40` y `shot1` en
  `.rea-evidence/shots`, fuera de git. Nunca se guardó, publicó ni ejecutó nada; al terminar el
  workflow seguía en Draft y «Saved».
- **B · Análisis estático del bundle.** `analyze-web-bundle` y `inspect-web-page` de REA sobre el
  iframe del editor, `client-app-automation-workflows.leadconnectorhq.com`, una app Vue con Vite y
  vue-flow. Solo se leyeron nombres de rutas, de estados y de campos. La extracción profunda del
  catálogo interno se detuvo a propósito.
- **H · Hipótesis.** Inferencia nuestra, marcada siempre como tal.

Límites encontrados:

1. El editor vive en un iframe de otro origen. REA observa la página principal, pero no el tráfico
   del iframe: rechaza los targets `iframe` con `target_not_allowed`, y abierto aparte el iframe
   queda en blanco porque recibe la sesión del padre. No hay cuerpos de respuesta de la API de
   workflows; solo nombres de rutas del bundle.
2. El workflow observado no tiene inscripciones. Las pestañas Enrollment history y Execution logs
   salieron vacías, así que sus columnas se conocen y sus contenidos no.
3. La documentación de reintentos de webhooks se contradice entre tres páginas oficiales.

---

## 1 · Editor visual

### 1.1 Lienzo en árbol con autolayout, triggers arriba en paralelo

- **Observado.** Lienzo con cuadrícula, zoom de 100%, ajustar a pantalla, mano para desplazar y
  minimapa. Los triggers son tarjetas lado a lado en la parte superior y se unen en un solo
  conector hacia el primer paso. Entre dos pasos siempre hay un «+» circular. Las acciones están en
  una sola columna centrada. Hay un selector «Standard builder» para cambiar el modo del lienzo.
- **Evidencia.** O `shot1`, `s15`. B: rutas y nombres `advanced-canvas`, `grid-layout`,
  `vue-flow-background`, layouts `horizontal` y vertical, `statsMode`. D:
  https://help.gohighlevel.com/support/solutions/articles/155000001254-workflow-builder-walkthrough
- **Hipótesis.** El modo estándar calcula las posiciones a partir de la estructura y no guarda
  coordenadas. Un modo avanzado, «advanced canvas», sí guarda una disposición.
- **Pruebas.** Mover un nodo en Standard builder y recargar; ver si recupera la posición. Comparar
  con el modo avanzado.
- **Implicaciones.** Empezar con autolayout vertical sin coordenadas guardadas: menos estado, sin
  conflictos de sincronización y nada que se desordene. `@xyflow/react` ya está en el proyecto.

### 1.2 Catálogo lateral con buscador, grupos y favoritos

- **Observado.**
  - Al pulsar «+» o «Add new trigger» se abre un panel derecho con buscador y dos pestañas: las
    nativas, Triggers o Actions, y Apps.
  - Los nodos van en grupos plegables, por ejemplo Contact, Communication, Internal, Affiliate,
    Associations y Communities.
  - Cada fila lleva icono, nombre, un pin para fijar como favorito y una flecha.
  - Algunas filas llevan insignia: corona para premium, BETA o New.
  - Las acciones que no aplican al contexto se ven atenuadas.
  - El buscador también encuentra coincidencias en la descripción: «if» devolvió «Email
    verification».
  - Mientras eliges, el lienzo muestra un hueco provisional, «Please select», en la posición de
    inserción.
- **Evidencia.** O `s15`, `s18`, `s19`, `s21`, `s22`, `s24`. B: `pinned`, `masterType`
  `highlevel | marketplace | internal`.
- **Hipótesis.** El catálogo sale de un registro de nodos con metadatos: grupo, icono, descripción,
  si es premium, si está en beta y si está disponible. Las Apps son nodos que se registran en
  tiempo de ejecución, con su propio esquema de campos.
- **Pruebas.** Desconectar una integración y ver si su acción pasa a atenuada. Buscar un término
  que solo esté en la descripción.
- **Implicaciones.** Un **registro de nodos** como única fuente de verdad para el catálogo, la
  validación, el formulario y MCP. Un nodo nuevo es una entrada más en el registro.

### 1.3 Panel de configuración por nodo con guardado explícito

- **Observado.**
  - Clic en un nodo abre su panel: nombre de la acción, descripción, «Learn more», flechas para
    pasar al nodo anterior o siguiente, y abajo «Delete», «Cancel» y «Save action».
  - El guardado de la acción es explícito; el workflow muestra «Saved» con una nube, lo que indica
    autoguardado.
  - Wait ofrece «Set up with AI».
- **Evidencia.** O `s28`, `s30`. B: `PUT /:id/auto-save` distinto de `PUT /:id`, `autoSaveSession`,
  `autoSavedBy`.
- **Hipótesis.** Hay dos niveles de guardado: «Save action» confirma el borrador del nodo dentro
  del workflow, y el autoguardado persiste el borrador del workflow en el servidor sin crear
  versión.
- **Pruebas.** Cambiar un campo, pulsar Cancel y verificar que el nodo vuelve al valor anterior.
  Ver si «Saved» cambia sin pulsar nada.
- **Implicaciones.** El nodo se edita en una copia local y se aplica con «Guardar paso». El
  borrador de la automatización se guarda solo, y publicar es otra acción.

### 1.4 Validación visible en el lienzo

- **Observado.** El paso «Assign to user» muestra un círculo naranja con «!». Su panel contiene un
  id de usuario sin nombre, señal de un usuario que ya no existe. La barra izquierda tiene un icono
  naranja de alerta.
- **Evidencia.** O `shot1`, `s30`. B: validadores por tipo de espera con `result: error`, y la ruta
  `validate-workflows`. D: la pestaña Needs Review «displays all workflows containing an error»,
  https://help.gohighlevel.com/support/solutions/articles/155000003065-error-notifications-in-workflows
- **Hipótesis.** Cada tipo de nodo tiene un validador que devuelve errores por campo. El error se
  pinta en el nodo y se suma en un contador global. Las referencias rotas, como un usuario
  borrado, cuentan como error.
- **Pruebas.** Publicar con un error y ver si lo impide. Borrar un tag usado y ver si el nodo se
  marca.
- **Implicaciones.**
  - `validate(params, ctx)` forma parte de cada definición de nodo.
  - Publicar exige cero errores.
  - Las referencias, como tag, etapa o cliente, se validan contra los datos actuales.

### 1.5 Deshacer y rehacer, portapapeles y notas

- **Observado.** Botones de deshacer y rehacer en la barra superior.
- **Evidencia.** O `shot1`. B: instantáneas del workflow y de los triggers para deshacer, el
  portapapeles `copiedNodes`, los MIME `application/workflow-tree` y
  `application/x-workflow-subtree-move`, y las notas fijas `use-sticky-notes` y
  `update-workflow-note`.
- **Hipótesis.** El deshacer guarda la definición completa en cada cambio. Se puede copiar y mover
  un subárbol entero.
- **Pruebas.** Mover una rama con arrastre; copiar y pegar un If/Else con hijos.
- **Implicaciones.** Con una definición inmutable en el editor, deshacer es una pila de copias.
  Mover subárboles y notas fijas pueden esperar a una V2.

---

## 2 · Triggers

### 2.1 Varios triggers por workflow, unidos con OR

- **Observado.** Una tarjeta «Form Submitted» con filtro «Form is any of …» y al lado «Add new
  trigger». Cada tarjeta tiene duplicar, borrar y «Stats».
- **Evidencia.** O `shot1`. D: «All triggers in the workflow will activate when their specific
  conditions are met», en el walkthrough citado en 1.1.
- **Hipótesis.** Cada trigger es una suscripción independiente; cualquiera inscribe al sujeto.
- **Pruebas.** Dos triggers, disparar uno solo, y ver que el contacto entra.
- **Implicaciones.** `triggers[]` dentro de la automatización, cada uno con sus filtros.

### 2.2 El trigger es una entidad aparte que «añade al workflow»

- **Observado, solo en el bundle.**
  - Al guardar se envía la diferencia entre triggers viejos y nuevos, `oldTriggers` y
    `newTriggers`, y existe la ruta `PUT /only-triggers/:id`.
  - Cada trigger lleva `type`, `masterType`, `conditions[]`, la acción fija
    `{ type: add_to_workflow, workflow_id }` y un `targetActionId` opcional.
- **Evidencia.** B.
- **Hipótesis.**
  - Los triggers viven en otra colección, indexada por tipo de evento, para encontrar rápido qué
    workflows escuchan un evento sin cargar todos.
  - `targetActionId` permite que un trigger inscriba en un paso concreto, no en el primero.
- **Pruebas.** No se pueden hacer sin acceso a la API. La interfaz no muestra el punto de entrada
  por trigger en el modo estándar.
- **Implicaciones.**
  - Guardar en una tabla aparte una fila por trigger, `automation_triggers`, con su tipo de
    evento, para indexar. Se deriva de la definición publicada.
  - El punto de entrada por trigger queda como mejora futura.

### 2.3 Filtros del trigger con operadores tipados

- **Observado.** «Form is any of …».
- **Evidencia.** O `shot1`. B: el enum de operadores de trigger incluye igualdad, desigualdad,
  `<`, `<=`, `>`, `>=`, `has_value`, `has_no_value`, `contains`, `contains-any`, `contains-none`,
  `is-any-of`, `is-none-of`, `between`, `has-changed`, `time-diff-now-gte`, `time-diff-now-lte` y
  varios operadores de arrays y cadenas.
- **Hipótesis.** El filtro es `{ field, operator, value }` y el operador depende del tipo del
  campo.
- **Pruebas.** Un trigger «Contact changed» con `has-changed` sobre un campo.
- **Implicaciones.** Un conjunto pequeño de operadores por tipo de campo, el mismo para los
  filtros del trigger y para If/Else.

### 2.4 Categorías de triggers y triggers sin sujeto

- **Observado.** La categoría Contact contiene Birthday reminder, Contact changed, Contact created,
  Contact DND, Contact tag, Custom date reminder, Note added, Note changed, Task added, Task
  reminder y Contact engagement score.
- **Evidencia.** O `s15`. D: una lista de unas 15 categorías,
  https://help.gohighlevel.com/support/solutions/articles/155000002292-a-list-of-workflow-triggers
- **Evidencia del trigger Scheduler.** D:
  https://help.gohighlevel.com/support/solutions/articles/155000006653-workflow-trigger-scheduler
  - Diario, semanal, mensual o cron.
  - Como máximo una vez por hora.
  - No recupera ocurrencias pasadas.
  - Los pasos que necesitan contacto se registran como omitidos y la ejecución sigue.
- **Hipótesis.** Cada tipo de workflow tiene un **sujeto**: contacto, oportunidad, negocio u
  objeto propio. Así lo indica el enum `IWorkflowType` del bundle, con `contact`, `opportunity`,
  `business`, `custom_object` y `agent`.
- **Implicaciones.**
  - Una automatización tiene un tipo de sujeto: contacto, prospecto, cliente, tarea, reunión o
    ninguno, en el caso de una programada.
  - El tipo de sujeto restringe qué nodos son válidos.

---

## 3 · Nodos

### 3.1 Catálogo amplio agrupado por dominio

- **Observado.**
  - Acciones de contacto: Add y Remove contact tag, Assign to user, Remove assigned user, DND,
    Add to notes, Copy contact, Edit conversation, Add task, Delete contact, Modify engagement score
    y followers.
  - Mensajería, marketing de terceros y afiliados.
  - En Internal está «If / else».
- **Evidencia.** O `s18`, `s19`, `s21`, `s22`, `s24`. D: 14 categorías; Internal Tools incluye If
  Else, Wait, Goal Event, Split, Update Custom Value, Go To, Remove from Workflow, Arrays, Drip, Text
  Formatter y Custom Code,
  https://help.gohighlevel.com/support/solutions/articles/155000002294
- **Implicaciones.** Separar nodos de **dominio**, que tocan datos, de nodos de **control**, que
  deciden el flujo. El control es pequeño y estable; el dominio crece.

### 3.2 Los nodos producen salidas que usan los pasos siguientes

- **Observado, en el bundle y la documentación.**
  - Math Operation guarda un resultado que puede leer un If/Else.
  - Las variables siguen el patrón `{{tipo_de_paso.índice.result}}`.
  - El selector de variables recorre los nodos anteriores, «upstream».
- **Evidencia.** D:
  https://help.gohighlevel.com/en/support/solutions/articles/155000003356-workflow-action-math-operation
  B: `getUpstreamNodes`, `mathOperationResults`, `custom-var-preview`.
- **Hipótesis.** Cada ejecución guarda las salidas de cada paso y la plantilla se resuelve contra
  ese contexto.
- **Implicaciones.**
  - El resultado de un nodo incluye `output`.
  - Las variables siguen la forma `{{steps.<nodeId>.<clave>}}`.
  - El selector solo ofrece las salidas de los nodos anteriores en la misma rama.

### 3.3 Nodos de terceros con esquema dinámico

- **Evidencia.** B: `actions/published/:type/dynamic-fields` y
  `triggers/published/:type/dynamic-fields`. D:
  https://marketplace.gohighlevel.com/docs/marketplace-modules/CustomActions
  - La plataforma hace POST a la app con `data`, `extras` y `meta`.
  - Si la app devuelve `branchId`, la rama se elige de forma síncrona.
  - Se puede pausar el paso hasta recibir un webhook de reanudación.
- **Implicaciones.**
  - El contrato del nodo debe permitir tres resultados: seguir por un puerto, esperar hasta una
    fecha o un evento, y fallar.
  - Con esos tres casos cabe cualquier nodo futuro, incluido uno externo.

---

## 4 · Conexiones

### 4.1 Estructura en árbol, sin uniones

- **Observado.**
  - Cada paso tiene un solo padre.
  - Las ramas de If/Else divergen y no se vuelven a juntar.
  - Para volver a un paso anterior existe el nodo Go To, que solo puede ir al final de una rama.
- **Evidencia.** B: los pasos guardan `parentKey` y `next`, que puede ser un id o una lista; las
  aristas se derivan de `parentKey` y no se guardan. D: Go To «can only be added as a last step of
  a workflow or a branch»,
  https://help.gohighlevel.com/support/solutions/articles/155000003377-workflow-action-go-to
- **Hipótesis.** El árbol simplifica el autolayout, la validación y la ejecución. Go To es el único
  salto, y por eso hace falta un candado contra bucles.
- **Pruebas.** Intentar unir dos ramas en un mismo paso: la interfaz no lo permite.
- **Implicaciones.**
  - Guardar `nodes[]`, cada uno con `next: { [puerto]: nodeId | null }`.
  - Las aristas no se guardan.
  - El validador exige un árbol: un solo padre, sin ciclos salvo Go To, y Go To solo como hoja.

### 4.2 Ramas como nodos hijos

- **Observado.** If/Else tiene una lista de ramas con nombre, reordenables, y una rama «None» fija.
- **Evidencia.** O `s25`, `s26`. B: `condition-node`, `cat: multi-path`, y nodos `transition`
  para las cabezas de rama.
- **Implicaciones.** El nodo condición guarda sus ramas como **puertos** con id propio. Cada puerto
  apunta al primer nodo de su rama. La rama «none» siempre existe.

---

## 5 · Condiciones

### 5.1 Ramas, segmentos y AND/OR

- **Observado.**
  - Cada rama tiene un nombre de hasta un número de caracteres que muestra el contador, y una o
    más segmentos.
  - Dentro de un segmento, las condiciones son campo y operador con un conector AND u OR.
  - Hay «Add segment», «Add branch» y «Reorder branches».
  - «Scenario recipe» ofrece plantillas de condición o «Build your own».
  - La rama None se usa «When no condition is met».
- **Evidencia.** O `s25`, `s26`. D: la rama None «cannot be removed»,
  https://help.gohighlevel.com/en/support/solutions/articles/155000002471
- **Hipótesis.**
  - Las ramas se evalúan en orden y gana la primera que se cumple; por eso se pueden reordenar.
  - Un valor que falta no detiene la ejecución, según la documentación.
- **Pruebas.** Dos ramas que se cumplen a la vez: verificar que gana la primera.
- **Implicaciones.**
  - `Branch { id, name, groups: ConditionGroup[] }` y
    `ConditionGroup { join: 'and' | 'or', conditions: Condition[] }`.
  - Primera rama que se cumple, o None.
  - Un campo vacío nunca lanza error; se evalúa como vacío.

### 5.2 Operadores

- **Evidencia.** B: los operadores del If/Else incluyen `is`, `is_not`, `contains`, `not_contains`,
  `starts_with`, `ends_with`, `is_empty`, `is_not_empty`, `greater_than`, `less_than`, `before`,
  `after`, `between` e `includes`. D: no hay una lista pública oficial.
- **Implicaciones.** Operadores por tipo:
  - texto: is, is_not, contains, not_contains, starts_with, is_empty, is_not_empty.
  - número: =, ≠, >, <, between.
  - fecha: before, after, between, más hace N días.
  - lista o tags: includes, not_includes.
  - booleano: is.

---

## 6 · Ejecución

### 6.1 Inscripción por sujeto y reentrada

- **Observado.** Settings, Contact:
  - «Allow re-entry» encendido: un contacto puede volver a entrar cuando sale del workflow. Si
    intenta entrar mientras sigue inscrito, se omite.
  - «Allow multiple opportunities» encendido.
  - «Stop on response» apagado.
- **Evidencia.** O `s36`. D:
  https://help.gohighlevel.com/support/solutions/articles/48001239875-workflow-settings-overview y
  el cambio del valor por defecto a encendido,
  https://ideas.gohighlevel.com/changelog/allow-re-entry-default-setting-changes
- **Hipótesis.** Existe una clave única por workflow y sujeto mientras la inscripción está activa.
- **Pruebas.** Disparar dos veces seguidas para el mismo contacto: la segunda se omite y queda en
  el log del trigger.
- **Implicaciones.**
  - `reentry: 'allow' | 'never'`, con `allow` por defecto.
  - Nunca dos ejecuciones activas para la misma automatización y el mismo sujeto.
  - El intento rechazado se registra como «omitido: ya inscrito».

### 6.2 Una inscripción es una máquina de estados con paso actual y próxima ejecución

- **Observado.** Columnas de Enrollment history: Record, Enrollment reason, Date enrolled, Current
  action, Current status, Next execution on y Actions. El historial cubre los últimos 60 días.
- **Evidencia.** O `s37`. B: `workflowStatusId`, `force-resume`, `stop-execution`,
  `count-per-step`, `details-by-step`, `requeue-stuck-statuses/:stepId`, `remove-stuck-statuses`.
- **Hipótesis.** Por cada sujeto inscrito hay un registro con su paso actual, su estado y la fecha
  de la próxima ejecución. Las acciones manuales operan sobre ese registro:
  - forzar la reanudación salta una espera;
  - detener la ejecución;
  - reencolar a los atascados en un paso, con opción de reintentar el paso.
- **Implicaciones.**
  - Tabla `automation_runs` con `node_id`, `status`, `next_at`, `attempts`, `reason` y `version`.
  - Índice por estado y `next_at`.
  - Acciones: cancelar, reanudar ya, reintentar el paso.

### 6.3 Draft frente a Publish, y pausa

- **Observado.** Switch «Draft / Publish» arriba a la derecha.
- **Evidencia.** O `shot1`. D: «Draft mode means the workflow will not trigger and take actions
  for real». Los contactos en espera «will remain at their current step» al volver de Draft. B:
  estados `published`, `draft`, `workflow-loop-lock` y `workflow-scheduled-pause`, y el estado de
  log `paused_due_to_draft_mode`.
- **Implicaciones.** Estados de una automatización: `draft`, `active`, `paused` y `locked`.
  - Pasar a `paused` deja de inscribir y congela las esperas.
  - Al volver a `active`, las esperas se reanudan. Si ya vencieron, corren y se marcan «con
    retraso».

### 6.4 Editar mientras hay ejecuciones en curso

- **Evidencia.** D:
  - Los cambios en pasos futuros aplican a los contactos en curso.
  - «Changing the Wait action does not update the wait for contacts already in that step.»
  - https://help.gohighlevel.com/support/solutions/articles/155000002470/
  - Si se borra un paso, los contactos que esperaban en él pueden ser retirados.
- **Hipótesis.** GHL lee la definición viva en cada paso. Eso explica las rarezas: pasos borrados
  y contactos retirados.
- **Implicaciones.** Para DayliOS es más fiable **fijar la versión publicada** en cada ejecución:
  editar y publicar no cambia lo que ya está corriendo. Migrar ejecuciones a la versión nueva
  queda para el futuro.

### 6.5 Carreras y bucles

- **Evidencia.** D:
  - Las actualizaciones «in the same second» pueden ejecutarse en desorden,
    https://help.gohighlevel.com/support/solutions/articles/48001218068-troubleshooting-workflow-executions-race-conditions
  - Bloqueo por bucle: «50 Starts/Executions for the same Contact in less than 30 minutes» bloquea
    el workflow,
    https://help.gohighlevel.com/support/solutions/articles/48001193281-loop-lockouts
  - B: `loop-lock/:workflowId` y el estado de log `loop_identified`.
- **Implicaciones.**
  - Un solo motor por proceso, sin dos ticks a la vez.
  - Pasos de dominio serializados.
  - Profundidad máxima en la cadena de causas.
  - Candado: más de 20 inscripciones del mismo sujeto en 30 minutos pasa la automatización a
    `locked`, con aviso. Se desbloquea a mano.

---

## 7 · Persistencia

### 7.1 Versiones

- **Evidencia.** D:
  - Se crea versión al guardar a mano, al confirmar el aviso de cambios sin guardar, con «Save
    version» y al cambiar de estado.
  - «routine auto-saves do not create new versions».
  - Se guardan hasta 10 versiones o 30 días.
  - Restaurar abre la versión como borrador nuevo.
  - https://help.gohighlevel.com/support/solutions/articles/155000006656
  - B: `history/v2`, `history-by-number`, `/:id/versions`, `copy-workflow`, `recover` tras borrar.
- **Implicaciones.**
  - `automations.draft` guarda el borrador vivo y `automation_versions` guarda las publicadas, de
    forma inmutable y con número.
  - Publicar crea una versión.
  - Restaurar copia una versión al borrador.
  - Se guardan las últimas 10.

### 7.2 Auditoría de quién hizo qué

- **Evidencia.** B: cada acción manual envía `actionFrom: { userId, channel, source }`.
- **Implicaciones.** Las acciones manuales se registran con su origen: `user`, `claude` o
  `system`. Encaja con la actividad de N5.

---

## 8 · Tareas programadas

### 8.1 Tipos de espera

- **Observado.**
  - For a set period of time.
  - Until a specific date/time.
  - Until a recurring window opens, marcado New.
  - Until a scheduled date/time, por ejemplo una hora antes de una cita.
  - Until the contact replies.
  - Until a user replies.
- **Evidencia.** O `s28`. B: tipos `time`, `specific_date`, `recurring_schedule`,
  `attendee_event_date`, `overdue`, `condition`, `reply`, `user_replied`, `email_event` y
  `link_clicked`. Con `convertToMultipath`, la espera con timeout se convierte en un nodo con dos
  salidas. D: https://help.gohighlevel.com/support/solutions/articles/155000002470/
- **Hipótesis.** Hay dos familias de espera:
  - por tiempo: el motor calcula `next_at`;
  - por evento: el motor se suscribe a un evento con un timeout. Al ocurrir sale por «cumplido» y
    al vencer sale por «timeout».
- **Implicaciones.**
  - V1: esperar N minutos, horas o días; esperar hasta una fecha y hora, fija o tomada de un campo
    con desplazamiento; y esperar hasta que se cumpla una condición, con timeout y dos puertos.
  - Las ventanas recurrentes quedan para V2.

### 8.2 Zona horaria y ventana horaria

- **Observado.**
  - Timezone «Account timezone»: «Wait steps and Time window executions will proceed based on this
    timezone».
  - «Time window, Specific time» restringe el envío fuera de la ventana.
- **Evidencia.** O `s34`, `s35`. D: la ventana pausa solo acciones de comunicación, no las
  internas.
- **Implicaciones.** DayliOS tiene un solo dueño por Mac: se usa la zona del sistema. La ventana
  horaria aplica solo a los nodos marcados como «comunicación».

---

## 9 · Reintentos

### 9.1 Hay reintentos con límite

- **Evidencia.** B: estado de log `failed_retry_limit_reached` y `requeue-stuck-statuses` con
  `retryStep=true`. D, contradictoria:
  - 6 reintentos cada 10 minutos solo ante 429,
    https://ideas.gohighlevel.com/changelog/marketplace-automated-webhook-retries
  - backoff exponencial hasta 3 días,
    https://help.gohighlevel.com/support/solutions/articles/155000007071-automated-webhook-retries
  - hasta 12 intentos ante cualquier respuesta que no sea 2xx,
    https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide
  - Las tres hablan de webhooks de apps. Para la acción Custom Webhook de un workflow no hay nada
    documentado.
- **Hipótesis.** Los pasos externos se reintentan con backoff hasta un límite. Después quedan como
  `failed_retry_limit_reached` y se pueden reintentar a mano.
- **Implicaciones.**
  - Solo se reintentan los nodos marcados `external`: 3 reintentos a 1, 5 y 30 minutos ante error
    de red, 429 o 5xx. Ante un 4xx falla de inmediato.
  - Idempotencia con la clave `runId:nodeId`.
  - Los nodos internos no se reintentan: corren en una transacción y fallan con su motivo.
  - Hay reintento manual del paso.

### 9.2 Avisos de error

- **Evidencia.** D: email a los administradores, como máximo uno cada 24 h, apagado por defecto.
- **Implicaciones.** Notificación del Mac y una insignia en Automatizaciones cuando una ejecución
  falla. Un aviso por automatización cada 24 horas.

---

## 10 · Registros de ejecución

### 10.1 Estados por paso

- **Evidencia.** B: los estados de log se clasifican en tres familias.
  - Éxito: `success`, `executed`, `finished`, `wait_finished`, `added_to_workflow` y
    `winner_declared`.
  - Error: `failed`, `error`, `wait_window_failed`, `loop_identified` y
    `failed_retry_limit_reached`.
  - Neutro: `wait_time`, `wait_time_future`, `wait_condition`, `wait_reply`, `wait_email_event`,
    `wait_link_clicked`, `paused_due_to_draft_mode`, `skipped` y `step`.
  - Además cada paso registra inicio, fin, duración y su iteración si va en un bucle.
- **Implicaciones.**
  - Estados de paso propios: `ok`, `skipped`, `waiting`, `failed` y `retrying`, cada uno con
    `reason`.
  - Estados de ejecución: `active`, `waiting`, `finished`, `failed`, `cancelled` y `skipped`.
  - El paso guarda inicio, fin, intento, mensaje y salida.

### 10.2 Vistas

- **Evidencia.** O `s37`: Enrollment history con filtro de fechas, de evento, búsqueda por
  contacto, refrescar y una retención de 60 días. D:
  https://help.gohighlevel.com/support/solutions/articles/155000003992
  - Execution logs filtra por acción y fecha, como máximo 30 días.
  - «Highlight Contact Path» resalta el recorrido del contacto en el lienzo.
  - B: `trigger/logs` con `top-failed-reasons`, que registra también los disparos rechazados y su
    motivo, y `Stats` por trigger y por paso.
- **Implicaciones.**
  - Tres vistas: **Inscripciones**, una fila por ejecución; **Registro**, una fila por paso; y
    **Estadísticas en el lienzo**, conteos por nodo.
  - Al abrir una ejecución se resalta su camino en el lienzo.
  - Los disparos rechazados también se registran: filtro no cumplido, ya inscrito o automatización
    pausada.
  - Retención de 60 días.

---

## Lo que no se pudo verificar

- Los cuerpos reales de la API del workflow, por el límite del iframe.
- Qué pasa con un paso borrado en una edición normal; solo está documentado el caso de los
  snapshots.
- El límite de pasos por workflow, la duración máxima de una espera y los límites de Custom Code.
- Qué política de reintentos aplica hoy; las fuentes se contradicen.
- El orden de evaluación entre workflows distintos ante el mismo evento.

Nada de esto bloquea el diseño: en cada caso DayliOS toma una decisión explícita en el spec.
