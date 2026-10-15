# Roadmap · Equipo, nube y visibilidad

Arreglos y funciones nuevas pedidos por el dueño el 13 oct 2026: persistencia de la interfaz,
tablero de tareas, dashboard configurable, cuentas, organizaciones, sincronización en la nube de
datos y archivos, y actividad del equipo en tiempo real.

## Principios

1. **Local primero.** SQLite y la bóveda en disco siguen siendo la persistencia por defecto. La app
   funciona completa sin cuenta, sin red y sin gastar recursos en sincronizar.
2. **La nube es un módulo aparte.** Nada de la nube se carga si no está activada. El código local no
   depende del código de nube: la nube se conecta por puertos y adaptadores.
3. **Dos ediciones desde el diseño.** Edición Local, gratuita, y Edición Equipo, con cuenta,
   organización y sincronización, que puede ser de pago en el futuro. El cobro no se implementa
   ahora, solo el punto donde se decide qué puede hacer cada edición.
4. **Las decisiones técnicas se toman con evidencia.** Backend, motor de sincronización,
   autenticación y almacenamiento de archivos se deciden en ADRs dentro de N0 y N4, con criterios
   escritos, antes de construir.
5. **Mismo patrón de siempre.** Tipos en `src/shared`, modelo y migración, servicio, controlador y
   rutas, IPC y preload, herramienta MCP, interfaz con diseño atómico y el tema Obsidian. El
   backend nuevo sigue arquitectura hexagonal.

## Módulos

### Bloque A · Local, se entrega primero

| #   | Carpeta                  | Qué resuelve                                                                   | Depende de |
| --- | ------------------------ | ------------------------------------------------------------------------------ | ---------- |
| A1  | `ui-persistence`         | La ventana vuelve como la dejaste: pantalla, historial, vistas, scroll, tamaño | nada       |
| A2  | `consultora-tasks-board` | Sección Tareas en Consultora con tablero por estado, lista y filtros           | A1         |
| A3  | `dashboard`              | Dashboard con componentes elegibles: tareas, pipeline, ganados y perdidos      | A1, A2     |

### Bloque N · Equipo y nube

| #   | Carpeta             | Qué resuelve                                                          | Depende de |
| --- | ------------------- | --------------------------------------------------------------------- | ---------- |
| N0  | `cloud-foundations` | Ediciones, ADRs, puertos, metadatos, Supabase y `services/cloud` base | A1         |
| N1  | `accounts-auth`     | Cuenta, inicio de sesión desde la app, sesión segura en el Llavero    | N0         |
| N2  | `organizations`     | Organizaciones, roles, invitaciones, responsables de tareas           | N1         |
| N3  | `cloud-sync`        | Sincronización de los datos en tiempo real, sin conexión y conflictos | N2         |
| N4  | `cloud-files`       | Evaluación y sincronización de archivos: bóveda, documentos, imágenes | N3         |
| N5  | `team-realtime`     | Presencia, quién edita qué, actividad del equipo y avisos             | N3, N4     |

Orden recomendado: A1, A2, A3 en paralelo con la evaluación de N0. Después N1 a N5 en orden.

Estado: A1, A2, A3 y N0 a N5 escritos, pendientes de la prueba manual de cada checklist. Siguen la pasada de diseño W6 y V2 de N5: edición simultánea, comentarios y menciones.
Cada módulo deja la app usable al terminar.

## Decisiones del dueño, 13 oct 2026

1. La interfaz principal es el popover del menubar. A1 empieza por él; Consultora va después.
2. La nube usa **Supabase** como plataforma: PostgreSQL, identidad, tiempo real y almacenamiento.
   La lógica propia vive en un **microservicio NestJS** dentro de este repositorio, en
   `services/cloud`, con arquitectura hexagonal. El despliegue se decide después: un Worker de
   Cloudflare o un servidor.
3. Se empieza por el bloque A mientras se evalúa N0.

## Decisiones técnicas

| ADR    | Pregunta                                       | Módulo | Estado y recomendación                                                                                 |
| ------ | ---------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| ADR-01 | Backend                                        | N0     | **Decidido**: Supabase y microservicio NestJS en `services/cloud`                                      |
| ADR-02 | Motor de sincronización                        | N0     | **Aprobado**: registro de cambios propio, último gana por campo con reloj híbrido; Realtime solo avisa |
| ADR-03 | Proveedor de identidad                         | N0     | **Decidido**: Supabase Auth con Google y código por email; el microservicio valida sus tokens          |
| ADR-04 | Dónde viven los archivos                       | N4     | **Aprobado**: Cloudflare R2 con la API de S3; Drive como conector aparte más adelante                  |
| ADR-05 | Edición simultánea de notas y boards           | N0     | **Aprobado**: notas con copia de conflicto; boards fusionados por tarjeta; V2 Yjs                      |
| ADR-06 | Despliegue del microservicio                   | N0     | **Aprobado**: contenedor en el oeste de EE. UU. con Supabase us-west-1; prueba del Worker abierta      |
| ADR-07 | Seguridad y privacidad de los datos del equipo | N0     | **Aprobado**: TLS, RLS por organización, roles, retención de 30 días; E2E en V2                        |

Nota sobre ADR-06: NestJS está pensado para Node en un servidor o contenedor. Si el destino es un
Worker de Cloudflare hay que comprobar antes que NestJS corre ahí. Como el dominio y los casos de
uso no dependen de NestJS, la capa HTTP se puede cambiar por una más ligera sin tocar la lógica.

## Fuera de alcance de este roadmap

Cobro y planes, tema claro, aplicación móvil, comentarios y menciones, permisos por carpeta, y la
edición simultánea letra a letra de notas, que queda como V2 de N5.

## Verificación

La hace el dueño en cada módulo: `npm install`, `typecheck`, `lint`, `test`, reiniciar la app y
recorrer la lista de comprobación de su `tasks.md`.
