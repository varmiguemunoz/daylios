# ADR-04 · Dónde viven los archivos

- Estado: aprobado
- Fecha: 14 oct 2026
- Módulo: N4

## Contexto

La organización comparte la bóveda del workspace, las carpetas de documentos de los clientes y, si
se activa, las grabaciones. Los registros ya viajan por N3. Hace falta un almacén para el contenido
de los archivos con permisos por organización, subidas grandes que se reanudan y un costo que se
pueda cobrar por espacio.

El modelo de N4 es el mismo para cualquier almacén: un manifiesto por archivo que sincroniza N3, con
ruta, hash, tamaño y fecha, y el contenido como objeto inmutable por hash. Solo el microservicio
tiene credenciales del almacén y entrega URLs firmadas de corta duración.

## Opciones

| Opción               | Cómo funciona                                                    | A favor                                                                                                                                                 | En contra                                                                                                                                                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A · Supabase Storage | Buckets en el mismo proyecto; URLs firmadas y subida reanudable. | Ya está en la plataforma, sin otra cuenta. Pro incluye 100 GB y 250 GB de descarga.                                                                     | Descarga a 0,09 USD por GB pasados los 250 GB. API propia, menos portable.                                                                                                                                                                                                                                  |
| B · Cloudflare R2    | Almacén con API de S3, URLs firmadas y subida por partes.        | Sin costo de descarga. 0,015 USD por GB al mes. API de S3: se cambia a S3, Backblaze o MinIO sin tocar la app. Ya usas Cloudflare para el hub de leads. | Otra cuenta y otras credenciales en el servidor.                                                                                                                                                                                                                                                            |
| C · Amazon S3        | El estándar de la API de S3.                                     | Muy maduro, muchas regiones.                                                                                                                            | Descarga cara: 0,09 USD por GB. Más configuración.                                                                                                                                                                                                                                                          |
| D · Google Drive     | Cada persona conecta su Drive y la app guarda ahí.               | Los archivos se ven en Drive.                                                                                                                           | Cada miembro debe conectar su cuenta. Sus permisos no siguen los roles de la organización. Para acceso completo a archivos, Google exige verificación y una auditoría CASA anual de 540 a 3 000 USD; solo `drive.file` evita la auditoría, y ese alcance solo ve lo que la app creó. Límites de peticiones. |
| E · Dropbox          | Igual que Drive con la API de Dropbox.                           | Sincronización conocida.                                                                                                                                | Cuenta por persona, aprobación de producción para muchos usuarios, permisos ajenos a la organización.                                                                                                                                                                                                       |

## Criterios

Puntuación de 1 a 5. Peso de 1 a 3.

| Criterio                                    | Peso | A · Supabase | B · R2 | C · S3 | D · Drive | E · Dropbox |
| ------------------------------------------- | ---- | ------------ | ------ | ------ | --------- | ----------- |
| Permisos por organización desde el servidor | 3    | 5            | 5      | 5      | 1         | 1           |
| Costo con 100 organizaciones                | 2    | 3            | 5      | 2      | 4         | 3           |
| Archivos grandes y reanudación              | 2    | 4            | 5      | 5      | 3         | 3           |
| Sin verificación ni auditorías de terceros  | 2    | 5            | 5      | 5      | 1         | 2           |
| Dependencia del proveedor                   | 2    | 3            | 5      | 4      | 2         | 2           |
| Esfuerzo de puesta en marcha                | 2    | 5            | 4      | 3      | 2         | 2           |
| Cobrar por espacio                          | 1    | 4            | 5      | 4      | 1         | 1           |
| **Total ponderado**                         |      | **59**       | **68** | **57** | **28**    | **28**      |

## Costo estimado

Supuesto por organización: 2 GB de bóveda y documentos y 5 GB de descargas al mes entre sus
miembros. Grabaciones fuera.

| Organizaciones | Supabase Storage, sobre Pro               | Cloudflare R2                  | Amazon S3 |
| -------------- | ----------------------------------------- | ------------------------------ | --------- |
| 1              | 0 USD, dentro de lo incluido              | 0 USD, dentro del nivel gratis | 0,50 USD  |
| 10             | 0 USD                                     | 0,15 USD                       | 5 USD     |
| 100            | 25 USD: 100 GB y 250 GB de descarga extra | 3 USD                          | 50 USD    |

Las operaciones de R2 cuestan 4,50 USD por millón de escrituras y 0,36 USD por millón de lecturas,
centavos con este uso.

## Prueba corta

Escrita, sin ejecutar por la regla de no correr pruebas en esta sesión:
`services/cloud/spikes/storage-bench.ts` sube y baja 1 000 archivos pequeños y uno de 80 MB por
partes contra cualquier almacén S3: R2, S3 o MinIO en local. Mide tiempo total, fallos y que el hash
coincida al bajar.

## Decisión

Opción B, Cloudflare R2 con la API de S3, detrás del puerto `ObjectStorage`. Para desarrollo local,
MinIO con el mismo adaptador. Si un día conviene, Supabase Storage o S3 son otro adaptador.

Google Drive y Dropbox quedan fuera como almacén. Más adelante pueden ser un conector aparte para
importar o exportar carpetas, con el alcance `drive.file`, que no exige auditoría.

## Consecuencias

- Descargas sin costo: abrir la bóveda muchas veces al día no encarece el plan.
- Una cuenta más, Cloudflare, con su clave solo en el microservicio.
- Los archivos no se ven en Finder fuera de DayliOS más que en la bóveda local, que sigue siendo una
  carpeta normal.
