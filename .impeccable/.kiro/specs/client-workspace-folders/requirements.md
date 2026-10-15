# Requisitos · Carpetas de cliente en el Workspace

## Problema

Hoy la carpeta de un cliente se crea en `docsPath/<Cliente>`, al lado del Workspace y fuera de él:
`client.service.ts`, `insertClient`, `join(config.docsPath(), safeFolderName(name))`. Por eso lo que
creas en el Workspace no aparece en la ficha del cliente y lo que guarda la ficha no se ve en el
Workspace.

## Objetivo

Una sola carpeta por cliente, dentro del Workspace, que se ve y se edita igual desde los dos lados.

## Decisiones del usuario, 15 de octubre de 2026

- **D1** Las carpetas existentes se mueven solas al Workspace al abrir la nueva versión, con copia de
  seguridad previa.
- **D2** Toda nota dentro de la carpeta de un cliente aparece en la sección Notas de ese cliente.
- **D3** El nombre de la carpeta raíz es `Clientes`, en español como el resto de la app. Decisión
  propia, fácil de cambiar.

## R1 · Ubicación

- R1.1 Crear un cliente crea `Workspace/Clientes/<Nombre>` con las subcarpetas de siempre:
  Contratos, Entregables, Documentación técnica, Reuniones.
- R1.2 El nombre de carpeta sale de `safeFolderName` y es válido en macOS y Windows: sin `<>:"/\|?*`,
  sin punto ni espacio al final, sin nombres reservados de Windows como CON o NUL.
- R1.3 Si ya existe una carpeta con ese nombre, se reutiliza; no se crea `Nombre 2`.
- R1.4 Renombrar el cliente renombra su carpeta y conserva el contenido, las notas y los boards.
- R1.5 Borrar el cliente con «Mover carpeta a la Papelera» la mueve a la Papelera del sistema, como
  hoy.

## R2 · Migración

- R2.1 Al arrancar, cada cliente con carpeta fuera de `Workspace/Clientes` se mueve allí.
- R2.2 Antes de mover se copia la carpeta original a `docsPath/_respaldo/<fecha>/<Cliente>`.
- R2.3 Se actualizan `clients.folder_path` y `meetings.recording_path` que apunten a la carpeta
  vieja.
- R2.4 Si el destino ya existe, se fusiona sin pisar archivos: un archivo repetido queda como
  `nombre (antiguo).ext`.
- R2.5 La migración se puede repetir sin efecto y deja un registro en el log.
- R2.6 Un error en un cliente no detiene la migración de los demás; la app avisa en Ajustes.

## R3 · Ficha del cliente

- R3.1 La sección Documentos pasa a ser **Archivos**: un explorador de la carpeta del cliente con
  carpetas, notas, boards y archivos.
- R3.2 Desde la ficha se puede crear nota, board y carpeta, subir archivos, renombrar y mover a la
  Papelera, dentro de la carpeta del cliente.
- R3.3 Abrir una nota o un board lo abre en el Workspace; un archivo abre su vista previa o la app
  predeterminada, como hoy.
- R3.4 «Abrir carpeta» abre la carpeta del cliente en el Workspace; «Mostrar en Finder» o «Mostrar en
  el Explorador» la abre en el sistema.
- R3.5 La sección Notas muestra las relaciones manuales y, además, toda nota dentro de la carpeta.
  Las de la carpeta llevan la marca «En la carpeta» y no se pueden desvincular; se desvinculan
  sacándolas de la carpeta.
- R3.6 Lo que se crea en el Workspace aparece en la ficha sin recargar, en el siguiente aviso del
  vigilante del Workspace.

## R4 · Organización y nube

- R4.1 En una organización la ruta es `Organizaciones/<Org>/Workspace/Clientes/<Nombre>`, la misma
  estructura.
- R4.2 Al crear una organización trayendo lo local, las carpetas de cliente viajan dentro del
  Workspace.
- R4.3 Un cliente que llega por sincronización crea su carpeta en `Workspace/Clientes` del equipo que
  lo recibe. `folder_path` sigue siendo local de cada equipo.
- R4.4 Los archivos se sincronizan con el motor de archivos actual, cuya raíz ya incluye el
  Workspace.

## R5 · MCP

- R5.1 `get_client` devuelve los archivos y las notas de la carpeta con el mismo criterio de R3.
- R5.2 `list_documents`, `read_document` y `write_document` siguen funcionando con la nueva ruta.

## Fuera de alcance

- Cambiar las subcarpetas por defecto.
- Carpetas para proyectos o prospectos.
