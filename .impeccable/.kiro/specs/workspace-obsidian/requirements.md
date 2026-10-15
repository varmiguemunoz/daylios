# Requisitos · Workspace estilo Obsidian

## Contexto

El workspace funciona, pero se ve como una pantalla más de Consultora: barra lateral, cabecera de
búsqueda y grabación, vista de carpeta con tarjetas y un lienzo con los estilos de React Flow. El
dueño quiere entrar a un espacio limpio que se vea y se comporte como Obsidian, con un canvas rápido
y bonito, y con grupos que muevan lo que contienen.

Decisiones del dueño, 13 oct 2026:

1. Atajo global ⌥⌘W, configurable en Ajustes.
2. Obsidian completo dentro del workspace: grises neutros, tipografía del sistema y colores de
   Obsidian. El resto de DayliOS no cambia.
3. Toda nota se llama como su título, sin fecha delante, también en «Notas rápidas».

## R1 · Modo workspace limpio

- R1.1 Al entrar al workspace se ocultan la barra lateral de Consultora y la cabecera de búsqueda y
  grabación. Solo queda el workspace a pantalla completa.
- R1.2 A la izquierda, una cinta de iconos estrecha, como la de Obsidian. Sus botones son: abrir la
  navegación de Consultora como panel flotante, mostrar u ocultar el explorador, buscar, nueva nota
  y nuevo board.
- R1.3 Arriba, una franja fina que sirve para arrastrar la ventana. Respeta los botones de macOS y
  muestra el nombre del archivo abierto.
- R1.4 Si hay una grabación en curso, la franja muestra un punto «REC» que lleva a la grabación.
- R1.5 Desde el panel de navegación se vuelve a cualquier sección. Al salir del workspace, la barra y
  la cabecera vuelven.
- R1.6 ⌘F, la búsqueda global de Consultora, sigue funcionando dentro del workspace como buscador de
  la bóveda.

## R2 · Explorador como el de Obsidian

- R2.1 El explorador lista carpetas y archivos en un solo árbol: filas compactas, sin tarjetas, el
  archivo abierto resaltado.
- R2.2 Clic en una carpeta la despliega o la pliega. Clic en un archivo lo abre a la derecha.
- R2.3 Cabecera del explorador con iconos: nueva nota, nueva carpeta, ordenar y plegar todo.
- R2.4 Arrastrar dentro del árbol mueve. Soltar archivos de Finder sobre una carpeta los sube.
- R2.5 Clic derecho mantiene el menú actual, y en carpetas suma «Ver contenido». Esa vista de
  carpeta con lista o cuadrícula se conserva como vista secundaria.
- R2.6 Sin archivo abierto, el panel principal muestra un estado vacío con nueva nota, nuevo board y
  los archivos recientes.
- R2.7 ⌘O abre el selector rápido de Obsidian: escribir y Enter abre el archivo. Con Enter sobre un
  nombre que no existe, crea la nota.

## R3 · Notas: el título es el nombre

- R3.1 La primera línea con texto de una nota, sin el `#`, es su nombre de archivo, en cualquier
  carpeta. Las notas rápidas dejan de llevar la fecha delante.
- R3.2 El nombre se actualiza al salir de la nota y también tras dos segundos sin escribir, cuando el
  editor vuelve a lectura.
- R3.3 Renombrar una nota desde el menú cambia también su primera línea, así nombre y título nunca se
  separan.
- R3.4 Si ya existe otra nota con ese nombre en la carpeta, se usa «Título 2».
- R3.5 Las notas existentes conservan su nombre hasta la próxima vez que se editen.
- R3.6 En el workspace la nota se lee como en Obsidian: columna centrada de lectura, título grande
  arriba y relaciones abajo, como los backlinks.

## R4 · Atajo global

- R4.1 ⌥⌘W, desde cualquier app, abre Consultora directamente en el workspace con el último archivo
  abierto.
- R4.2 Si el workspace ya está delante, el mismo atajo oculta la ventana.
- R4.3 El atajo se cambia en Ajustes, igual que el de nota de voz. Si otra app lo usa, Ajustes lo
  avisa.

## R5 · Canvas como el de Obsidian

- R5.1 Fondo gris de Obsidian con puntos que siguen el zoom. Sin sombras ni estilos de React Flow a
  la vista.
- R5.2 Tarjetas con radio pequeño y borde fino. Con color, el borde es del color y el fondo un tinte
  suave. Seleccionadas, un anillo del color de acento.
- R5.3 Se cambia el tamaño arrastrando cualquier borde o esquina, sin tiradores visibles. El cursor
  avisa.
- R5.4 Al pasar el ratón por una tarjeta salen cuatro puntos en los lados. Arrastrar uno a otra
  tarjeta conecta. Soltarlo en el vacío crea una tarjeta nueva ya conectada y lista para escribir.
- R5.5 Barra flotante abajo al centro, como la de Obsidian: tarjeta, nota del workspace, imagen y
  grupo. Cada icono también se puede arrastrar al lienzo para soltarlo donde se quiera.
- R5.6 Controles verticales arriba a la derecha: acercar, alejar, ajustar todo, deshacer y rehacer.
- R5.7 Menú flotante sobre la selección: borrar, color, ajustar la vista a la selección y crear
  grupo.
- R5.8 Doble clic en el vacío crea una tarjeta y entra a escribir de inmediato.
- R5.9 Ajuste a cuadrícula de 20 px al mover y al cambiar tamaño, con ⌥ para soltarlo libre.
- R5.10 Flechas mueven la selección 1 px, o 10 px con ⇧. ⌘A selecciona todo.

## R6 · Grupos

- R6.1 Seleccionar varias tarjetas y pulsar «Crear grupo», o ⌘G, crea un grupo que las envuelve con
  margen y entra a escribir su nombre.
- R6.2 Mover un grupo mueve todo lo que está dentro, grupos anidados incluidos. Dentro significa que
  el elemento cabe entero en el rectángulo del grupo, como en Obsidian.
- R6.3 Soltar una tarjeta dentro de un grupo la mete. Sacarla la saca. No hay nada más que hacer.
- R6.4 El nombre del grupo va encima de su esquina superior izquierda, en un rótulo pequeño. Doble
  clic lo edita.
- R6.5 El grupo puede tener color: borde y tinte, como las tarjetas.
- R6.6 Borrar un grupo pregunta si se borra solo el marco o también su contenido.
- R6.7 Se guarda tal cual en JSON Canvas: Obsidian abre el board con los mismos grupos.

## R7 · Rendimiento

- R7.1 Con 500 tarjetas, desplazar y hacer zoom va a 60 fps en un Mac con Apple Silicon.
- R7.2 Mover una tarjeta no vuelve a pintar las demás.
- R7.3 Con poco zoom, el texto de las tarjetas se sustituye por barras grises, como en Obsidian. Se
  ahorra pintar markdown que no se puede leer.
- R7.4 Guardar no convierte el board a JSON en cada movimiento: solo medio segundo después del último
  cambio.
- R7.5 Abrir un board de 500 tarjetas tarda menos de 300 ms en verse.

## Fuera de alcance

- Pestañas y paneles divididos, vista de grafo, enlaces `[[...]]` y backlinks automáticos.
- Editor en vivo tipo Live Preview; la nota sigue con lectura y edición por doble clic.
- Incrustar páginas web en el canvas, presentaciones y exportar a imagen.
