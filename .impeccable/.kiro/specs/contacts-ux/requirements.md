# Requisitos · Contactos (UX)

## Contexto

La lista de Contactos mezcla buscador, dos desplegables y una fila de chips antes de llegar a las
personas. La ficha apila «Email marketing» y dos selectores (Cliente y Prospecto) que confunden: un
contacto aparece ligado a un cliente **y** a un prospecto a la vez sin que se entienda qué significa.
El dueño quiere una lista limpia, filtros en un panel lateral, una ficha más clara y una acción rápida
para convertir un contacto en prospecto.

## R1 · Lista

- R1.1 En la pantalla solo quedan: título con contador, buscador, botón «Filtros» (con número de
  filtros activos), «Nuevo contacto» y la lista.
- R1.2 «Filtros» abre un panel lateral derecho con: Suscripción (Todos, Suscritos, Sin marketing,
  Bajas, Rebotes, Spam), Tags (varios a la vez; el contacto debe tenerlos todos; con conteo), Fuente,
  Empresa (cliente), En pipeline (cualquiera, sí, no). «Limpiar filtros» al pie.
- R1.3 Los filtros aplican al instante y vuelven a la página 1. Esc o clic fuera cierra el panel.
- R1.4 Fila: iniciales en círculo, nombre (o email), «rol · empresa», hasta 2 tags y «+n», estado de
  suscripción solo si no es `none`.
- R1.5 Búsqueda por nombre, rol, email, empresa y teléfono.

## R2 · Relaciones del contacto

- R2.1 Un contacto puede pertenecer a **un cliente**, a **un proyecto** de ese cliente y a **un
  prospecto**, a la vez o por separado (ajuste del dueño).
- R2.2 Los selectores dejan de ser desplegables nativos sueltos: sección «Relaciones» con tres filas
  (Cliente, Proyecto, Prospecto). Cada fila muestra el vínculo como enlace o «Asignar»; al editar,
  un selector con búsqueda (`RefPicker`) y «Quitar».
- R2.3 El prospecto muestra su pipeline y etapa («Acme · Outbound · Contacted»).

## R3 · Convertir en prospecto

- R3.1 Acción rápida visible en la cabecera de la ficha (y en el menú de la fila de la lista).
- R3.2 Abre un modal: pipeline, etapa (abiertas), empresa del prospecto (prellenada con el cliente o
  `fields.company` o el nombre), valor opcional. Crear → toast con «Abrir prospecto».
- R3.3 Si ya está en un prospecto, la acción pasa a «Ver en pipeline».

## R4 · Ficha (rediseño, impeccable)

- R4.1 Cabecera: nombre editable, «rol · empresa» con enlace, estado de suscripción, acciones rápidas
  (Email, LinkedIn, Convertir en prospecto) y menú «Más» (Suscribir o Dar de baja, Ejecutar
  automatización, Borrar).
- R4.2 Dos columnas: principal (Notas y Actividad) y lateral (Datos, Empresa, Tags, Email marketing,
  Formulario, Automatizaciones).
- R4.3 Actividad unifica eventos y reuniones en una línea de tiempo.
- R4.4 Los datos se editan en el sitio (clic en el valor), sin tarjetas de formulario grandes.

## R5 · Claude (MCP)

- R5.1 `list_contacts` acepta `tags` (lista), `client`, `in_pipeline`.
- R5.2 `convert_contact { id, pipeline?, stage?, company?, value_usd? }` (reemplaza
  `promote_contact`, que se mantiene como alias).
- R5.3 `delete_contact { id, confirm }`; `save_contact` acepta `project`; `detach_contact_prospect`.
