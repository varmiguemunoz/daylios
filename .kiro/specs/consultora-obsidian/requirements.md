# Requisitos · Consultora estilo Obsidian

## Contexto

El workspace ya se ve y se comporta como Obsidian. El resto de Consultora sigue con el estilo de
DayliOS: barra lateral de píldoras, cabecera con buscador, títulos en extra negrita, botones
redondos y tarjetas con sombra. Al cambiar de sección se nota el salto. El dueño quiere que toda la
ventana de Consultora tenga la misma estructura minimalista del workspace.

Decisión del dueño, 13 oct 2026: todo el módulo de Consultora con estilo Obsidian, manteniendo la
franja superior, la cinta de iconos y la barra lateral de navegación.

Supuestos, a confirmar al aprobar el plan:

1. La ventana del menubar no cambia. Solo cambia la ventana de Consultora.
2. Solo tema oscuro, como el workspace.
3. Ningún cambio de comportamiento ni de datos. Solo estructura visual, estilos y atajos de
   navegación.

## R1 · Tema en toda la ventana

- R1.1 El tema Obsidian está activo siempre en la ventana de Consultora, no solo en el workspace.
- R1.2 Los diálogos, menús, cajones y avisos que se abren en Consultora también lo usan.
- R1.3 La ventana del menubar se ve exactamente igual que hoy.

## R2 · Un solo marco para todas las secciones

- R2.1 Franja superior de 38 px para arrastrar la ventana. Muestra atrás y adelante, la ruta de lo
  abierto, por ejemplo «Clientes › Acme», el control de grabación y el menú «…» de lo abierto.
- R2.2 Cinta de iconos a la izquierda en todas las secciones: Secciones, Archivos, Buscar, Nueva
  nota, Nuevo board y Ajustes abajo.
- R2.3 Barra lateral acoplada, redimensionable de 180 a 480 px, que se oculta con ⌘\ y recuerda su
  ancho. Arriba tiene dos pestañas como Obsidian: Secciones y Archivos.
- R2.4 Secciones es la navegación de Consultora: Workspace, Clientes, Contactos, Reuniones,
  Pipeline, Tags y el grupo Email. La sección actual queda resaltada.
- R2.5 Archivos es el explorador de la bóveda. Abrir un archivo desde cualquier sección lleva al
  workspace con ese archivo.
- R2.6 Por defecto se ve Secciones fuera del workspace y Archivos dentro. Si el dueño cambia de
  pestaña, se recuerda por contexto.
- R2.7 El panel flotante de navegación del workspace desaparece. Ya no tapa el explorador.
- R2.8 La grabación nunca se corta al cambiar de sección. La franja muestra REC mientras graba.

## R3 · Búsqueda y atajos

- R3.1 ⌘K abre un buscador global flotante, como el selector rápido de Obsidian, sobre clientes,
  contactos, prospectos, reuniones, notas y archivos. Enter abre; «Ver todos» lleva a la pantalla
  de resultados.
- R3.2 ⌘O sigue abriendo el selector de archivos de la bóveda, ahora desde cualquier sección.
- R3.3 ⌘[ y ⌘] van atrás y adelante. ⌘\ muestra u oculta la barra lateral. ⌘, abre Ajustes.
- R3.4 Los atajos propios de cada pantalla siguen igual.

## R4 · Piezas compartidas

- R4.1 Botones, campos, selectores, etiquetas, menús, diálogos, cajones y filas siguen el estilo de
  Obsidian: radios de 4 a 8 px, sin sombras grandes, bordes de 1 px, pesos 500 y 600, alturas de
  28 a 32 px.
- R4.2 Las piezas que también usa el menubar cambian solo bajo el tema Obsidian, mediante tokens.
- R4.3 Los colores de estado usan la paleta de Obsidian: rojo, naranja, amarillo, verde, cian y
  violeta, como tinte suave con texto del color.

## R5 · Pantallas

- R5.1 Listas como las vistas de tabla de Obsidian: cabecera fina, filas de 32 px, separadores de
  1 px y resaltado al pasar el ratón. Aplica a clientes, contactos, reuniones, tags, fuentes,
  reglas, secuencias, newsletters y la tabla del pipeline.
- R5.2 Fichas como notas de Obsidian: título grande en línea, bloque de propiedades con icono,
  nombre y valor editable, y después las secciones como encabezados en una columna centrada de
  760 px. Aplica a cliente, contacto, prospecto, proyecto, reunión, documento y nota.
- R5.3 El tablero del pipeline como el plugin Kanban de Obsidian: columnas grises y tarjetas con
  borde fino, como las del canvas.
- R5.4 Ajustes como los de Obsidian: lista vertical de categorías a la izquierda y filas con nombre
  y descripción a la izquierda y el control a la derecha.
- R5.5 Estados vacíos, carga, errores y conflictos con el mismo tono: texto tenue centrado, sin
  ilustraciones ni tarjetas.

## R6 · Calidad

- R6.1 Funciona desde el ancho mínimo de la ventana, 860 px: la barra lateral se puede ocultar y
  nada se solapa.
- R6.2 Contraste AA en texto. El gris más tenue solo se usa en marcadores de posición y adornos.
- R6.3 Foco visible con el acento en todo lo interactivo. Todo se puede usar con teclado.
- R6.4 Respeta reducir movimiento.
