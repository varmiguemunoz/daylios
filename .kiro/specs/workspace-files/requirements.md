# Requisitos · W1 Bóveda, carpetas y archivos

## R1 · Bóveda

- R1.1 La bóveda es una carpeta real. Por defecto `<docsPath>/Workspace`, se puede cambiar en
  Ajustes. Si no existe, se crea al abrir el workspace.
- R1.2 La carpeta es la fuente de verdad. El índice en SQLite se reconstruye desde el disco.
- R1.3 Cambios hechos fuera de la app, en Finder o por Claude, aparecen solos en menos de 2 s.
- R1.4 Cada elemento tiene un id estable que sobrevive a renombrar y mover, dentro y fuera de la app.
- R1.5 Se ignoran archivos ocultos, `.DS_Store` y la carpeta `.obsidian`.

## R2 · Carpetas

- R2.1 Crear, renombrar y borrar carpetas. Subcarpetas sin límite práctico de profundidad.
- R2.2 Borrar una carpeta con contenido pide confirmación con lo que se pierde: N notas, N boards,
  N archivos. El contenido va a la Papelera de macOS, nunca se borra en duro.
- R2.3 Nombres inválidos en macOS se limpian. Un nombre repetido en la misma carpeta se rechaza
  con un mensaje claro.

## R3 · Archivos

- R3.1 Tipos: notas `.md`, boards `.canvas`, imágenes `png jpg jpeg gif webp svg` y cualquier otro
  archivo como adjunto genérico.
- R3.2 Subir desde el dispositivo con un botón o arrastrando desde Finder. Se copia a la carpeta
  actual. Límite de 50 MB por archivo.
- R3.3 Renombrar, mover y borrar cualquier elemento. Borrar va a la Papelera y avisa si el
  elemento está referenciado en notas o boards.
- R3.4 Mover arrastrando a una carpeta del árbol o de la vista, o con «Mover a…» y un buscador de
  carpetas. No se puede mover una carpeta dentro de sí misma.
- R3.5 Al renombrar o mover un archivo, se actualizan sus referencias en notas e imágenes de boards.
- R3.6 Las imágenes se ven en la app. Otros archivos se abren con su app de macOS.

## R4 · Navegación

- R4.1 Nueva sección **Workspace**, la primera en la barra lateral de Consultora.
- R4.2 A la izquierda, el árbol de carpetas plegable. A la derecha, el contenido de la carpeta.
- R4.3 Ruta de navegación arriba: cada tramo lleva a esa carpeta.
- R4.4 Vista lista o cuadrícula, recordada por carpeta. Orden por nombre o por fecha.
- R4.5 Menú contextual con clic derecho y botón de tres puntos: Abrir, Renombrar, Mover a,
  Mostrar en Finder, Borrar. En carpetas también Nueva nota, Nuevo board, Nueva carpeta, Subir.
- R4.6 Buscar en la bóveda por nombre y por texto de las notas, con ⌘K dentro del workspace.

## R5 · Estados

- R5.1 Carpeta vacía con acciones para crear o subir.
- R5.2 Carga con esqueleto, sin saltos. Error de disco con mensaje y reintento.
- R5.3 Responsive: con la ventana estrecha el árbol se pliega en un botón.

## R6 · Aislamiento

- R6.1 Ninguna operación lee o escribe fuera de la bóveda. Rutas con `..`, absolutas o symlinks
  que salen se rechazan.
- R6.2 Las imágenes llegan al renderer por el protocolo `vault://`, que valida la ruta. Nunca
  `file://`.
