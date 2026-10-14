# Tareas · N2 Organizaciones e invitaciones

## Fase 1 · Backend

- [x] 1. Tablas `organizations`, `memberships`, `invitations` y `plans`.
- [x] 2. Casos de uso de organización y miembros con la matriz de permisos probada.
- [x] 3. Invitaciones: crear, reenviar, revocar, aceptar una sola vez, caducidad. Email.

## Fase 2 · App

- [x] 4. Copias separadas por organización y `switchWorkspace` en main, con pruebas de cambio.
- [x] 5. Selector de organización en la cinta.
- [x] 6. Ajustes: miembros, roles, invitaciones, salir, transferir y borrar.
- [x] 7. Deep link de invitación con los casos de cuenta distinta.

## Fase 3 · Personas en los datos

- [x] 8. `assignee_id` en tareas, prospectos, proyectos y reuniones; propiedad «Responsable».
- [x] 9. Filtro «Mis tareas» en el tablero y en el dashboard.
- [x] 10. «Creado por» y «Cambiado por» en las fichas.

## Fase 4 · Cierre

- [x] 11. Límite de miembros leído de `entitlements`.
- [x] 12. Revisión estática y de permisos; README.

## Checklist

- [ ] Creo «Ali Muñoz Advisory» y paso a ella desde la cinta; Local sigue intacto
- [ ] Invito a un email como Miembro, abre el enlace, entra y aparece en la lista
- [ ] Un invitado de solo lectura no puede editar ni desde la app ni con la API
- [ ] Revoco una invitación y el enlace deja de servir
- [ ] Asigno una tarea a otro miembro y la ve en «Mis tareas»

## Notas de la implementación

- Cambiar de organización guarda la elegida y reinicia la app, en vez de cambiar la base en caliente.
  Cerrar y reabrir todos los servicios a la vez era el riesgo principal del diseño; reiniciar es un
  segundo y no puede dejar nada a medias.
- Cada organización tiene su base en `userData/orgs/<id>` y sus documentos y bóveda en
  `<carpeta de documentos>/Organizaciones/<nombre id>`. Local no cambia de sitio.
- Las operaciones que necesitan saltarse la RLS de forma controlada viven en funciones de PostgreSQL
  que vuelven a comprobar el permiso: crear organización, transferir, ver y aceptar una invitación,
  salir y ver los emails de los compañeros.
- La matriz de permisos es una sola función, `can`, en `src/shared/organizations.ts`. La usan el
  servicio para decidir y la app para ocultar.
- Invitaciones: token de 32 bytes, solo su hash en la base, 7 días, un uso. Reenviar genera un
  enlace nuevo y el anterior deja de valer. Sin `RESEND_API_KEY` se comparte copiando el enlace.
- El enlace de invitación apunta a `/invite/<token>` del servicio, que abre `daylios://invite/<token>`
  o muestra la descarga.
- Planes: `trial` con 5 miembros por defecto y `team` con 50. El límite se comprueba al invitar y
  al aceptar.
- Responsable en tareas, prospectos, proyectos y reuniones. «Mis tareas» en Tareas y en Inicio.
  «Creado por» y «Cambiado por» salen del registro de cambios.
- Pruebas escritas sin ejecutar, en `src/test`: `cloud-organizations` y `assignees`.
