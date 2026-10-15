# Requisitos · N0 Bases de la nube y ediciones

## Contexto

Todo lo de equipo, cuentas, organizaciones, sincronización de datos y archivos y actividad en tiempo
real necesita las mismas bases: saber qué edición está activa, poder enchufar la nube sin tocar el
código local, preparar las tablas para sincronizar y decidir con evidencia el backend, el motor de
sincronización, la identidad y el alojamiento. Este módulo no entrega nada visible salvo la pantalla
de edición en Ajustes; deja todo listo para N1 a N5.

## R1 · Dos ediciones

- R1.1 **Local**: la de hoy. SQLite y la bóveda en disco, sin cuenta, sin red para sincronizar, sin
  procesos ni conexiones de nube abiertos.
- R1.2 **Equipo**: cuenta, organización y sincronización. Se activa desde Ajustes y se puede
  desactivar sin perder los datos locales.
- R1.3 Por defecto la app arranca en Local. Pasar a Equipo nunca sube nada sin confirmación.
- R1.4 Un único punto decide qué permite cada edición: `entitlements`. Hoy responde según la edición;
  mañana podrá responder según un plan de pago, validado en el servidor.

## R2 · La nube como módulo enchufable

- R2.1 El código de nube vive aparte y se carga solo si la edición es Equipo.
- R2.2 Los servicios locales no importan nada de la nube. Hablan con puertos: `SyncPort`,
  `FileSyncPort`, `IdentityPort`, `PresencePort`. En Local los atienden adaptadores vacíos.

## R3 · Tablas listas para sincronizar

- R3.1 Cada tabla que se sincronizará tiene: id global único, `updated_at`, `deleted_at` para borrados
  suaves, una revisión ordenable entre dispositivos, `org_id` y `updated_by`, que en Local quedan
  vacíos.
- R3.2 Los borrados de esas tablas pasan a ser suaves; las consultas existentes los excluyen.
- R3.3 Cada cambio deja una entrada en un registro local de cambios, en la misma transacción. En
  Local se recorta solo y no crece sin límite.
- R3.4 Lista explícita de lo que nunca se sincroniza: claves de API, tokens, ajustes del dispositivo,
  estado de la interfaz, grabaciones en curso y colas de voz.

## R4 · Decisiones con evidencia

- R4.1 ADRs escritos para backend, motor de sincronización, identidad, edición simultánea,
  alojamiento y seguridad, con opciones, criterios, pruebas cortas y decisión.
- R4.2 Cada ADR lo aprueba el dueño antes de construir el módulo que depende de él.

## R5 · Pantalla de edición

- R5.1 Ajustes gana la categoría «Cuenta y equipo»: muestra la edición activa y qué incluye cada una.
  El botón para pasar a Equipo aparece en N1.
