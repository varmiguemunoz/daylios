# Requisitos · N4 Archivos en la nube

## Contexto

Además de los registros, la organización comparte archivos: la bóveda del workspace con notas
`.md`, boards `.canvas`, imágenes y adjuntos; las carpetas de documentos de cada cliente; y las
grabaciones y transcripciones de reuniones. Hay que decidir dónde se guardan en la nube y cómo se
sincronizan. Depende de N3 y de ADR-04.

## R1 · Evaluación

- R1.1 ADR-04 compara, con criterios y una prueba corta: Supabase Storage, que ya viene con la
  plataforma elegida; un almacén compatible con S3 como Cloudflare R2 o Amazon S3; integración
  bidireccional con Google Drive; y Dropbox.
- R1.2 Criterios: necesidades reales del producto, costo de almacenamiento y de descarga, permisos
  por organización, sincronización en tiempo real, límites de la API, verificación y permisos que
  exige cada proveedor para una app comercial, archivos grandes, privacidad, dependencia del
  proveedor y facilidad de cobrar por espacio.
- R1.3 El dueño aprueba ADR-04 antes de construir.

## R2 · Qué se sincroniza

- R2.1 La bóveda completa de la organización.
- R2.2 Las carpetas de documentos de los clientes.
- R2.3 Transcripciones y resúmenes van como datos en N3. Las grabaciones de video y audio quedan
  fuera por defecto y se pueden activar en Ajustes, por su tamaño.
- R2.4 Se ignoran archivos del sistema y temporales, como ya hace la bóveda.

## R3 · Comportamiento

- R3.1 Un archivo nuevo o cambiado por un miembro aparece en los demás sin hacer nada.
- R3.2 Renombrar y mover se propagan como renombrar y mover, sin volver a subir el contenido.
- R3.3 Borrar manda el archivo a una papelera de la organización durante 30 días, con restaurar.
- R3.4 Dos personas cambian el mismo archivo a la vez: se conserva el último y el otro queda como
  «nombre (conflicto de Ana, 13 oct).md» en la misma carpeta.
- R3.5 Archivos grandes se suben por partes y se reanudan si se corta la conexión.
- R3.6 Indicador por archivo en el explorador: subiendo, en la nube o con error.

## R4 · Espacio

- R4.1 Uso de espacio de la organización visible en Ajustes.
- R4.2 Límite de espacio leído de `entitlements`, preparado para planes de pago.
- R4.3 Tamaño máximo por archivo configurable en el servidor.

## R5 · Google Drive

- R5.1 Si ADR-04 descarta Drive como almacén principal, se valora como conector aparte para importar
  y exportar carpetas o enlazar documentos, fuera de esta versión.
