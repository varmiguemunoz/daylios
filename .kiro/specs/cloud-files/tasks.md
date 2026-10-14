# Tareas · N4 Archivos en la nube

## Fase 1 · Decisión

- [x] 1. ADR-04 con las opciones, los criterios, la prueba corta de subir y bajar 1 000 archivos y
      el cálculo de costo para 1, 10 y 100 organizaciones.
- [x] 2. El dueño aprueba ADR-04; se ajusta este diseño si hace falta.

## Fase 2 · Servidor

- [x] 3. Adaptador `ObjectStorage`, URLs firmadas, subida por partes y confirmación.
- [x] 4. Uso de espacio, límites por `entitlements` y limpieza de la papelera.

## Fase 3 · Cliente

- [x] 5. Manifiesto como entidad de N3 con hash, tamaño y ruta.
- [x] 6. `FileSyncEngine`: cola, concurrencia, reintentos, reanudación y escritura atómica.
- [x] 7. Vigilante de las carpetas de clientes y supresión del eco al descargar.
- [x] 8. Copias de conflicto y papelera con restaurar.
- [x] 9. Grabaciones opcionales en Ajustes.

## Fase 4 · Interfaz y cierre

- [x] 10. Estado por archivo en el explorador y uso de espacio en Ajustes.
- [x] 11. Asistente para llevar las carpetas de clientes a la ruta de la organización.
- [x] 12. Prueba de punta a punta con dos copias; revisión estática; README.

## Checklist

- [ ] Pego una imagen en una nota y la ve otro miembro en su nota
- [ ] Renombro una carpeta con 200 archivos y no se vuelve a subir nada
- [ ] Editamos la misma nota sin conexión y queda una copia de conflicto con el nombre de quien la hizo
- [ ] Corto el wifi a mitad de subir un PDF de 80 MB y al volver termina
- [ ] Borro un documento de un cliente y lo restauro desde la papelera de la organización

## Notas

- Una sola raíz: la carpeta de documentos de la organización. Workspace y clientes viven dentro.
- La tarea 11 se resolvió sin asistente: al crear la organización con datos de Local las carpetas
  de clientes se mueven solas a la ruta de la organización.
- Grabaciones apagadas por defecto.
- Las pruebas `files-domain` y `files-end-to-end` están escritas en `src/test` y no se han corrido.
