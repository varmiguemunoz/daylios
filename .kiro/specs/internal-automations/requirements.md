# Requisitos · Automatizaciones internas (reemplazan Reglas)

## Contexto

Las Reglas («cuando entra el tag X → añadir tag, disparar evento, pasar a pipeline») son poco útiles:
un solo disparador, cuatro acciones y nada en el tiempo. El dueño quiere automatizaciones como en
GoHighLevel, dentro de la app: un disparador, filtros y una lista de pasos (acciones y esperas) que
toquen todo lo interno (tags, contactos, clientes, proyectos, pipeline, tareas, notas) y envíen email
con Resend.

Decisiones: corren en la app local; constructor **lineal** (lista vertical de pasos, sin lienzo);
email de marketing solo a suscritos (opt-in).

## R1 · Estructura

- R1.1 Una automatización tiene: nombre, activa/pausada, **un disparador**, **filtros** opcionales
  (condiciones que deben cumplirse al dispararse), **pasos** en orden y política de reentrada.
- R1.2 Pasos: acción, espera, o «continuar solo si» (condiciones evaluadas en ese momento).
- R1.3 Reentrada: «una vez por contacto» (por defecto) o «cada vez que se dispare».
- R1.4 Nueva automatización = pausada hasta que se active.

## R2 · Disparadores (13)

| Clave                    | Cuándo                                           | Parámetros                  |
| ------------------------ | ------------------------------------------------ | --------------------------- |
| `contact.created`        | Entra un contacto (a mano, fuente o Claude)      | fuente (opcional)           |
| `contact.tag_added`      | A un contacto se le añade un tag                 | tag                         |
| `contact.tag_removed`    | A un contacto se le quita un tag                 | tag                         |
| `contact.subscribed`     | Pasa a suscrito                                  | —                           |
| `contact.unsubscribed`   | Se da de baja                                    | —                           |
| `contact.bounced`        | Rebota o marca spam                              | —                           |
| `prospect.created`       | Se crea un prospecto                             | pipeline (opcional)         |
| `prospect.stage_changed` | Un prospecto cambia de etapa                     | pipeline, de etapa, a etapa |
| `prospect.won`           | Llega a una etapa ganada                         | pipeline (opcional)         |
| `prospect.lost`          | Llega a una etapa perdida                        | pipeline (opcional)         |
| `client.created`         | Se crea un cliente                               | —                           |
| `meeting.ready`          | Una reunión termina de transcribirse y resumirse | —                           |
| `manual`                 | Se ejecuta a mano (ficha del contacto o Claude)  | —                           |

(+ `task.completed` con tag opcional, sujeto tarea, solo acciones de productividad.)

## R3 · Condiciones (10)

Tiene tag · No tiene tag · Estado de suscripción es · Fuente es · Tiene email · Campo del formulario
igual a / contiene · Tiene cliente · Está en el pipeline / etapa · Valor del prospecto ≥ N · El
prospecto está en etapa abierta.

## R4 · Acciones (23 + 2 de control)

Contacto

1. Añadir tag
2. Quitar tag
3. Actualizar dato (nombre, rol, teléfono, LinkedIn)
4. Guardar campo de formulario (clave = valor)
5. Añadir a las notas del contacto (texto con variables)
6. Asignar a cliente (elegido, o crear/usar el cliente con el nombre de `fields.company`)
7. Asignar a proyecto (del cliente del contacto)
8. Quitar de su cliente
9. Dar de baja de marketing
10. Borrar contacto (destructiva)

Pipeline 11. Convertir en prospecto (pipeline, etapa, valor) 12. Mover prospecto (pipeline, etapa) 13. Actualizar prospecto (valor, próximo paso, en N días) 14. Borrar prospecto (destructiva)

Clientes 15. Crear cliente desde el prospecto o el contacto 16. Crear proyecto en su cliente (nombre con variables)

Email (Resend) 17. Enviar email (asunto y cuerpo markdown con variables; solo suscritos; pie de baja) 18. Iniciar secuencia de Resend (dispara su evento) 19. Avisarme por email (a `ownerEmail`)

Productividad 20. Crear tarea para mí (título, en N días, tags, esfuerzo, descripción; si el día está lleno, el
siguiente con hueco) 21. Crear nota (con variables; relacionada con su cliente) 22. Notificación en el Mac

Integraciones 23. Webhook (POST JSON a una URL)

Control 24. Esperar N minutos / horas / días 25. Continuar solo si (condiciones)

## R5 · Variables

`{{contact.name}}`, `{{contact.first_name}}`, `{{contact.email}}`, `{{contact.company}}`,
`{{contact.role}}`, `{{fields.<clave>}}`, `{{prospect.company}}`, `{{prospect.stage}}`,
`{{prospect.value}}`, `{{client.name}}`, `{{today}}`. Variable vacía = texto vacío. El editor las
inserta con un clic.

## R6 · Ejecución

- R6.1 Corre en la app (Mac encendido). Al abrir, lo que venció se ejecuta y se marca «con retraso».
- R6.2 Cada disparo crea una **ejecución** con una copia de los pasos (editar la automatización no
  cambia ejecuciones en curso).
- R6.3 Acciones internas: en una transacción por paso; si fallan, la ejecución queda «falló» con el
  motivo.
- R6.4 Acciones externas (email, webhook): 3 reintentos (1 min, 5 min, 30 min); luego «falló».
- R6.5 Una acción que no aplica (sin email, no suscrito, sin prospecto) se **omite** con el motivo; la
  ejecución sigue.
- R6.6 Bucles: profundidad máxima 5 entre automatizaciones; una automatización no se re-dispara por su
  propia acción en la misma ejecución.
- R6.7 Pausar una automatización deja de crear ejecuciones nuevas; las que esperan se pueden
  cancelar en bloque.

## R7 · Historial y prueba

- R7.1 Cada ejecución guarda disparador, sujeto, estado y un registro por paso (hora, resultado,
  mensaje). Se ve en la automatización y en la ficha del contacto.
- R7.2 Cancelar una ejecución en espera.
- R7.3 «Probar con un contacto»: simulación sin escribir nada que muestra qué pasaría en cada paso.

## R8 · Seguridad

- R8.1 Automatizaciones con acciones destructivas piden marcar «Entiendo que borra registros» al
  guardar y se marcan en rose en la lista.
- R8.2 Email de marketing solo a `subscribed`, con pie de baja. «Avisarme por email» siempre al dueño.

## R9 · Migración y Worker

- R9.1 Cada regla existente se convierte en una automatización equivalente (disparador «tag añadido»).
  La pantalla Reglas, su tabla y su motor desaparecen.
- R9.2 El Worker deja de evaluar reglas: aplica tags de origen, por defecto y del payload, escribe el
  contacto en Resend, dispara `tag.<slug>` y encola. La app evalúa las automatizaciones al descargar.
- R9.3 La app acepta ítems del Worker viejo durante la transición.

## R10 · Claude (MCP)

`list_automation_catalog` (disparadores, condiciones, acciones con sus parámetros) ·
`list_automations` · `get_automation` · `save_automation` · `set_automation_status` ·
`delete_automation` · `test_automation` · `run_automation` (manual sobre un contacto) ·
`list_automation_runs` · `cancel_automation_run`.
