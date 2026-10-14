# Requisitos · N2 Organizaciones e invitaciones

## Contexto

Con cuentas, falta el espacio compartido. Una organización agrupa a sus participantes y es dueña de
la información que comparten. Depende de N1.

## R1 · Organizaciones

- R1.1 Crear una organización con nombre. Quien la crea es su dueño.
- R1.2 Una persona puede pertenecer a varias. Selector de organización abajo en la cinta, como el
  selector de bóvedas de Obsidian.
- R1.3 Cada organización tiene su propia copia local de datos y de bóveda, separada de la edición
  Local y de las demás organizaciones.
- R1.4 Renombrar, ver miembros y borrar la organización, solo el dueño, con confirmación escrita.

## R2 · Roles

- R2.1 Dueño: todo, incluido borrar y transferir la propiedad.
- R2.2 Admin: invitar, quitar miembros, cambiar roles salvo el del dueño, configurar integraciones.
- R2.3 Miembro: leer y editar la información de la organización.
- R2.4 Invitado de solo lectura: ver sin editar.
- R2.5 Los permisos los aplica el servidor; la app solo oculta lo que no se puede hacer.

## R3 · Invitaciones

- R3.1 Invitar por email con un rol. Llega un email con un enlace.
- R3.2 El enlace abre la app, o la página de descarga si no está instalada, y pide iniciar sesión.
- R3.3 La invitación caduca a los 7 días, se puede reenviar y revocar, y solo sirve una vez.
- R3.4 Lista de invitaciones pendientes con su estado.
- R3.5 También se puede copiar un enlace de invitación sin email.

## R4 · Salir y quitar

- R4.1 Un miembro puede salir. Al salir se borra su copia local de esa organización, con aviso.
- R4.2 Quitar a un miembro cierra su acceso en el siguiente intento de sincronizar.
- R4.3 La organización no se queda sin dueño: hay que transferir antes de salir.

## R5 · Trabajo con personas

- R5.1 Las tareas ganan responsable, uno de los miembros. Filtro «Mis tareas» en el tablero de A2.
- R5.2 Prospectos, proyectos y reuniones ganan responsable opcional.
- R5.3 Las fichas muestran quién creó y quién cambió por última vez.

## R6 · Preparado para cobrar

- R6.1 La organización guarda su plan y el número de miembros. Hoy todas tienen el plan gratuito de
  prueba; el límite de miembros se lee de `entitlements`.
