# Requisitos · Administración de clientes

## Contexto

Desde la ficha del cliente hoy se crean cosas pero no se pueden borrar ni corregir: proyectos de
prueba, clientes que nunca firmaron, documentos mal nombrados. Todo desde la vista de clientes.

## R1 · Borrar proyecto

- R1.1 Desde la fila del proyecto (en la ficha del cliente, al pasar el ratón) y desde la ficha del
  proyecto, borrar en dos pasos.
- R1.2 Sus reuniones quedan en el cliente (se quita solo el proyecto); los contactos asignados a ese
  proyecto quedan sin proyecto.

## R2 · Borrar cliente

- R2.1 Botón en la cabecera de la ficha → modal de confirmación con el impacto escrito:
  proyectos que se borran, reuniones, contactos y prospectos que se desvinculan, notas que pierden la
  relación.
- R2.2 La carpeta de documentos **se queda en el disco** por defecto. Casilla «Mover también la
  carpeta a la Papelera» (recuperable desde Finder).
- R2.3 Confirmar exige escribir el nombre del cliente (es irreversible en la app).
- R2.4 Tras borrar, vuelve a la lista de clientes.

## R3 · Documentos

- R3.1 Renombrar un documento en línea (misma carpeta; no se puede salir de la carpeta del cliente ni
  pisar otro archivo).
- R3.2 Borrar un documento: va a la Papelera de macOS (dos pasos).
- R3.3 Editar documentos de texto (`.md`, `.txt` y los demás de texto que ya se leen) dentro de la
  app con el editor markdown; guarda solo mientras escribes. El resto se abre con su app.
- R3.4 Errores claros si el archivo ya no existe o cambió fuera de la app.

## R4 · Notas

- R4.1 Relacionar notas con el cliente (módulo note-relations).

## R5 · Claude (MCP)

- R5.1 `delete_project { project, confirm }`, `delete_client { client, confirm, trash_folder? }`,
  `get_client_impact`.
- R5.2 `rename_document`, `delete_document { confirm }`, `write_document` (solo texto).
