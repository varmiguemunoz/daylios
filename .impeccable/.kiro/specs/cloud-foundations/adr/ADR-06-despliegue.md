# ADR-06 · Despliegue del microservicio

- Estado: aprobado
- Fecha: 13 oct 2026
- Módulo: N0

## Contexto

`services/cloud` es NestJS con arquitectura hexagonal y habla con Supabase PostgreSQL. El dueño
quiere desplegarlo después, en un Worker de Cloudflare o en un servidor. Los usuarios están en
Hermosillo y Phoenix.

Datos públicos revisados: desde agosto de 2025 los Workers ejecutan servidores HTTP de Node con
`node:http`, el permiso `nodejs_compat` y `httpServerHandler`. Cloudflare nombra Express y Koa como
compatibles. NestJS no aparece en esa lista, aunque por debajo usa Express.

## Opciones

| Opción                                     | Cómo funciona                                                                                      | A favor                                                                                                  | En contra                                                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A · Worker de Cloudflare                   | NestJS sobre su adaptador de Express, expuesto con `httpServerHandler`. PostgreSQL por Hyperdrive. | Barato, global, sin servidores que mantener. Mismo proveedor que el Worker del hub de leads.             | NestJS no está probado ahí: decoradores, `reflect-metadata` y el arranque en frío. Límites de CPU por petición. Conexiones a PostgreSQL con cuidado. |
| B · Contenedor en Fly.io, Railway o Render | La imagen de Node de NestJS tal cual, en la región oeste de EE. UU.                                | NestJS corre como está pensado. Despliegue con un Dockerfile. Conexiones largas a PostgreSQL sin trucos. | Un servicio que pagar y vigilar, aunque sea pequeño.                                                                                                 |
| C · VPS propio                             | Servidor con Docker y un proxy.                                                                    | Control total y costo fijo bajo.                                                                         | Parches, certificados y copias a cargo del dueño.                                                                                                    |

## Criterios

| Criterio                               | Peso | A · Worker | B · Contenedor | C · VPS |
| -------------------------------------- | ---- | ---------- | -------------- | ------- |
| NestJS funciona sin cambios            | 3    | 2          | 5              | 5       |
| Esfuerzo de operación                  | 3    | 5          | 4              | 2       |
| Costo con 1 a 100 organizaciones       | 2    | 5          | 4              | 4       |
| Latencia hacia Supabase y los usuarios | 2    | 4          | 5              | 4       |
| Riesgo de sorpresas                    | 2    | 2          | 5              | 4       |
| **Total ponderado**                    |      | **43**     | **55**         | **45**  |

## Prueba corta

Pendiente de ejecutar por el dueño. Se monta en `services/cloud/spikes/worker` cuando exista el
servicio base de N0:

1. `wrangler.toml` con `nodejs_compat` y fecha de compatibilidad posterior al 15 ago 2025.
2. Arrancar la app NestJS con `NestFactory.create` sobre Express, `listen(3000)` y exportar
   `httpServerHandler({ port: 3000 })`.
3. Medir: que responda `/health`, el arranque en frío, una consulta a PostgreSQL por Hyperdrive y
   el tiempo de CPU por petición de `/sync/push` con 100 mutaciones.

Si las cuatro pasan, el Worker vuelve a ser opción. Si alguna falla, se cambia solo la capa HTTP,
porque el dominio y los casos de uso no dependen de NestJS.

## Decisión

- V1: opción B, un contenedor en la región oeste de EE. UU., en la misma región que Supabase.
- Supabase en `us-west-1`, norte de California, la más cercana a Hermosillo y Phoenix.
- Copias: las diarias de Supabase Pro con 7 días de retención. La recuperación a un punto exacto
  cuesta 100 USD al mes por cada 7 días y se activa solo cuando haya clientes que paguen.
- La prueba del Worker queda abierta y puede cambiar esta decisión sin tocar el dominio.

## Consecuencias

- Despliegue predecible desde el primer día, con un Dockerfile y variables de entorno.
- Un costo mensual pequeño desde el principio, en vez de casi cero en un Worker.
- La salud, los registros y las alertas se configuran en el proveedor elegido.
