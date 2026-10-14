# Diseño · N2 Organizaciones e invitaciones

## 1 · Microservicio y Supabase

Tablas en Supabase PostgreSQL con RLS por membresía; los casos de uso viven en `services/cloud`.

- **Dominio:** `Organization`, `Membership` con rol, `Invitation` con hash del token, caducidad y
  estado, y `Plan`.
- **Casos de uso:** `CreateOrg`, `RenameOrg`, `DeleteOrg`, `TransferOwnership`, `Invite`,
  `ResendInvite`, `RevokeInvite`, `AcceptInvite`, `ChangeRole`, `RemoveMember`, `Leave`.
- **Autorización:** una política por caso de uso, `can(actor, action, org)`, probada con una matriz
  de roles. Toda consulta de datos de sincronización filtra por organización y membresía activa.
- **Email:** adaptador `Mailer`, con Resend o el email de Supabase; plantilla en español con el nombre
  de quien invita.

## 2 · App

- **Copias separadas:** cada organización usa su propia base y bóveda en
  `userData/orgs/<orgId>/daylios.sqlite` y `.../vault`. La edición Local sigue en su ruta actual.
  Cambiar de organización cierra la conexión TypeORM, abre la otra y reinicia el vigilante del
  workspace y el servidor MCP apunta a la activa.
- **Selector:** botón abajo en la cinta con las iniciales de la organización; menú con las
  organizaciones, «Local», «Crear organización» y «Gestionar».
- **Ajustes, «Cuenta y equipo»:** miembros con rol editable, invitaciones pendientes, invitar por
  email o copiar enlace, salir y, para el dueño, transferir y borrar.
- **Responsable:** columna `assignee_id` en tareas, prospectos, proyectos y reuniones, en la
  migración de N0 o una nueva. `RefPicker` de miembros en las propiedades.

## 3 · Deep link

`daylios://invite/<token>` abre la app, pide sesión si falta y llama a `AcceptInvite`. Si el email
no coincide con la cuenta, se explica y se ofrece cambiar de cuenta.

## 4 · Riesgos

- Cambiar de base en caliente: un único `switchWorkspace` en main que cierra y abre todo en orden,
  con pruebas.
- Invitaciones filtradas: token largo, solo hash en la base, un uso, caducidad y revocación.
