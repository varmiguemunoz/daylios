# ADR-01 · Backend de la nube

- Estado: aprobado
- Fecha: 13 oct 2026
- Módulo: N0

## Contexto

La edición Equipo necesita base de datos compartida, identidad, avisos en tiempo real y archivos. El
dueño trabaja con NestJS, Go y PostgreSQL y prefiere arquitectura hexagonal.

## Decisión

- **Supabase** como plataforma: PostgreSQL, Auth, Realtime y Storage.
- **Microservicio NestJS** en `services/cloud`, dentro de este repositorio, con la lógica propia:
  sincronización, organizaciones, invitaciones, permisos, ediciones y URLs de archivos.
- La app de escritorio habla con el microservicio por HTTP y con Supabase solo para iniciar sesión,
  recibir avisos y presencia.

## Consecuencias

- Menos infraestructura propia: identidad, tiempo real y almacenamiento vienen hechos.
- Dependencia de Supabase en esas tres piezas. Se limita con puertos: `Identity`, `Realtime` y
  `ObjectStorage` tienen su adaptador de Supabase y se pueden cambiar.
- El despliegue del microservicio queda en ADR-06. NestJS corre en Node; antes de elegir un Worker
  de Cloudflare hay que probar que funciona ahí o cambiar solo la capa HTTP.
