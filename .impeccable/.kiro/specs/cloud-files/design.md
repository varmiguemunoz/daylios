# Diseño · N4 Archivos en la nube

Diseño para la recomendación inicial de ADR-04, un almacén de objetos: Supabase Storage o uno
compatible con S3. Se rehace si el ADR elige otra cosa.

## 1 · Por qué la recomendación inicial es un almacén de objetos y no Drive

Supabase Storage es el primer candidato porque comparte identidad y permisos con el resto de la
plataforma. R2 se compara por costo de descarga. El puerto `ObjectStorage` permite cambiar de uno a
otro sin tocar la app.

A comprobar en la prueba corta del ADR:

- Un almacén de objetos da control total de permisos por organización desde el backend, con URLs
  firmadas de corta duración, sin que cada miembro conecte su propia cuenta.
- Con la API de S3 se puede cambiar de proveedor sin tocar la app: R2, S3, Backblaze o MinIO.
- Google Drive exige que cada persona conecte su cuenta, tiene límites de peticiones, sus permisos
  no siguen a los roles de la organización y, para acceso amplio a los archivos, Google pide una
  revisión de seguridad a las apps comerciales. Hay que verificar el alcance exacto en el ADR.
- Medir el costo de descarga, que en el uso diario de una bóveda puede pesar más que el
  almacenamiento.

## 2 · Modelo

- **Manifiesto:** cada archivo es un registro sincronizado por N3: `path`, `hash` SHA-256, `size`,
  `mtime`, `kind`, `rev` y `deleted_at`. Mover y renombrar solo cambian `path`.
- **Contenido:** objetos inmutables por hash, `orgs/<orgId>/blobs/<hash>`. El mismo contenido no se
  sube dos veces.
- **Subida:** el cliente pide URLs firmadas, sube por partes si pasa de 8 MB y confirma; solo
  entonces el manifiesto apunta al nuevo hash.
- **Bajada:** al recibir un cambio de manifiesto, descarga el objeto a un temporal, comprueba el hash
  y lo coloca con `rename` atómico. El vigilante del workspace ignora esa escritura para no
  reenviarla.
- **Conflicto:** si el archivo local cambió desde el último hash sincronizado y llega otro, se guarda
  el local como copia de conflicto y se coloca el remoto.
- **Papelera:** los objetos de archivos borrados se conservan 30 días y luego se limpian con una
  tarea del servidor.

## 3 · Cliente

- `cloud/files/FileSyncEngine` implementa `FileSyncPort`. Usa el vigilante existente de la bóveda y
  uno nuevo para las carpetas de clientes.
- Cola de subidas y bajadas con concurrencia limitada a 3, reintentos y reanudación.
- El explorador muestra el estado por archivo con un punto discreto, al estilo de Obsidian Sync.

## 4 · Servidor

- **Casos de uso:** `RequestUpload`, `CompleteUpload`, `RequestDownload`, `PurgeTrash` y `Usage`.
- **Adaptadores** `ObjectStorage` para Supabase Storage y para S3; credenciales solo en el
  microservicio.

## 5 · Riesgos

- Carpetas de clientes en rutas que el dueño elige en Ajustes: en Equipo pasan a una ruta por
  organización y se migran con un asistente.
- Notas editadas a la vez: V1 usa la copia de conflicto. La edición simultánea real es V2 de N5.
