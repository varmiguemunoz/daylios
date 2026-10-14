# ADR-07 · Seguridad y privacidad de los datos del equipo

- Estado: aprobado
- Fecha: 13 oct 2026
- Módulo: N0, aplica a N1 hasta N5

## Contexto

La edición Equipo sube datos de clientes, reuniones, contactos y notas a la nube. Son datos de
negocio sensibles. La edición Local no sube nada. Las claves de API y los tokens nunca deben salir
del dispositivo.

## Opciones

| Opción                                       | Cómo funciona                                                                                                                                                   | A favor                                                                       | En contra                                                                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A · Cifrado en tránsito y en reposo, con RLS | TLS en todas las conexiones. Supabase cifra en reposo. RLS por organización en cada tabla. El servicio usa su propio rol, nunca la clave de servicio en la app. | Estándar, compatible con búsquedas, métricas y Claude por MCP en el servidor. | El proveedor técnicamente puede leer los datos.                                                                                                           |
| B · Cifrado de extremo a extremo opcional    | Las notas o campos marcados se cifran en el dispositivo con una clave de la organización.                                                                       | El servidor no puede leerlos.                                                 | Sin búsqueda ni métricas en el servidor para esos datos. Perder la clave es perder los datos. Invitar a alguien exige compartir la clave de forma segura. |

## Decisión

V1 con la opción A y estas reglas:

1. **Transporte**: solo HTTPS y WSS. La app rechaza cualquier URL de nube sin TLS.
2. **Identidad**: tokens de Supabase validados en el servicio con las llaves públicas del proyecto.
   El token de refresco vive en el Llavero con `safeStorage`, nunca en archivos ni en `ui-state.json`.
3. **Aislamiento**: cada tabla en la nube tiene `org_id`. RLS permite leer y escribir solo a
   miembros activos de esa organización, según su rol. El servicio filtra además por organización
   en cada caso de uso, así que hay dos barreras.
4. **Roles**: dueño, administrador, miembro y lector. Solo dueño y administradores invitan,
   expulsan o cambian roles. Cada cambio de miembros queda en un registro de auditoría.
5. **Nunca se sincroniza**: `settings.json`, claves de API de OpenAI y Resend, secretos de fuentes,
   tokens, `ui-state.json`, la cola de voz, el estado de grabación y el `outbox` del email. Es una
   constante probada en N0 y el servicio rechaza esos campos si llegan.
6. **Grabaciones y archivos**: URLs firmadas de corta duración, nunca públicas. Detalle en ADR-04.
7. **Retención**: lo borrado queda 30 días como borrado suave y después se purga. Al salir de una
   organización se quita el acceso al instante; los datos se quedan en la organización. Borrar una
   organización la purga a los 30 días. Las copias de Supabase caducan a los 7 días.
8. **Exportar**: el dueño de la organización puede exportar todo como JSON y la bóveda como
   archivos.
9. **MCP**: Claude sigue leyendo solo el SQLite local del dispositivo, con las mismas reglas de hoy.
   No hay acceso de MCP directo a la nube.

V2: opción B solo para notas marcadas como privadas, si un cliente lo pide.

## Consecuencias

- Seguridad estándar de un SaaS, sin perder búsqueda ni métricas.
- Hay que probar RLS con pruebas que intenten leer de otra organización y fallen.
- Pasar a cifrado de extremo a extremo más adelante afecta solo a los datos marcados y no cambia
  el resto.
