# Requisitos · Tags, esfuerzo, arrastrar, contactos y subir grabaciones

## R1 · Tags de tareas
- R1.1 Tags libres: al escribir la tarea, cada palabra con `#` es un tag (`Llamar a Juan #ventas` → título «Llamar a Juan», tag `ventas`).
- R1.2 Minúsculas, sin `#`, sin espacios, máx. 24 caracteres, máx. 5 por tarea.
- R1.3 En el detalle: añadir (con sugerencias de tags ya usados) y quitar.
- R1.4 Se ven como chips en Hoy, Historial y detalle. Color neutro (no tienen significado propio).

## R2 · Esfuerzo
- R2.1 Opcional: `alto`, `medio`, `bajo`.
- R2.2 Al escribir: `!alto`, `!medio`, `!bajo` (o `!a`, `!m`, `!b`).
- R2.3 En el detalle: selector de tres opciones (clic otra vez = quitar).
- R2.4 Indicador de 3 barras en la fila (1, 2 o 3 llenas).

## R3 · Arrastrar tareas
- R3.1 En Hoy, arrastrar una fila cambia su posición. Se guarda al soltar.
- R3.2 Teclado: `⌥↑` / `⌥↓` sobre una fila la mueve.
- R3.3 Una línea apricot marca dónde caerá.

## R4 · Arrastrar en el pipeline
- R4.1 Arrastrar una tarjeta a otra columna la cambia de etapa (ganada → cliente, como hoy).
- R4.2 Dentro de una columna, el orden se puede cambiar y se guarda.

## R5 · Contactos
- R5.1 Persona: nombre, rol, email, teléfono, LinkedIn, notas (markdown), cliente o prospecto (opcional).
- R5.2 Sección «Contactos» en la barra lateral: lista con búsqueda; detalle editable.
- R5.3 En la ficha de cliente y de prospecto: sus contactos y «Añadir contacto».
- R5.4 Al ganar un prospecto, sus contactos pasan al cliente nuevo.
- R5.5 Participantes de reunión: sugiere nombres de contactos.
- R5.6 Claude: `list_contacts`, `get_contact`, `save_contact`; `get_client` incluye contactos.

## R6 · Subir grabaciones
- R6.1 En Reuniones: «Subir grabación» (o arrastrar un archivo a la pantalla). Formatos: mp4, mov, m4v, mkv, webm, mp3, m4a, wav.
- R6.2 Antes de procesar: título, participantes, asociación (sugerida por el título) e **idioma hablado: Español o English** (solo esos dos).
- R6.3 El archivo se copia a la carpeta de documentos (`_reuniones/` o `<Cliente>/Reuniones/`); el original no se toca.
- R6.4 Mismo procesado que una grabación: transcripción en el idioma elegido + resumen. Fecha = fecha del archivo; duración leída del archivo.
- R6.5 Las grabaciones en vivo también eligen idioma al detener.
- R6.6 Claude: `import_recording(path, language, …)`.

## Fuera de alcance
Filtrar Historial por tag, colores por tag, arrastrar tareas entre días, importar contactos (CSV/vCard), traducir transcripciones.
