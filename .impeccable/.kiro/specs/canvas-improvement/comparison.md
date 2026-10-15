# Comparación · Obsidian Canvas frente a DayliOS

Equivale a `research/canvas-comparison.md`. Fuentes: `research-obsidian.md` y `audit.md`.

Decisión: **Replicar**, **Mantener** lo de DayliOS, **Extender** con algo propio, o **Decidir** con
el usuario.

## Interacción

| área                                           | Obsidian                    | DayliOS                 | decisión                                 |
| ---------------------------------------------- | --------------------------- | ----------------------- | ---------------------------------------- |
| rango de zoom                                  | 0.0625 a 2 [O]              | 0.1 a 3                 | Replicar                                 |
| zoom alejado                                   | oculta contenido, icono [O] | barras grises bajo 0.45 | Mantener, D2                             |
| grosor de conexión                             | constante en pantalla [O]   | escala con zoom         | Replicar                                 |
| flechas                                        | 20 y 100 [O]                | 1 y 10                  | Replicar                                 |
| ajuste a rejilla                               | sí                          | sí, 20                  | Mantener                                 |
| ajuste a objetos                               | sí [O]                      | no                      | Replicar                                 |
| desactivar ajuste                              | ⌃ [O]                       | ⌥                       | Replicar, D1                             |
| ⌥ y arrastrar                                  | clona [O]                   | colocación libre        | Replicar, D1                             |
| ⇧ y arrastrar                                  | fija eje [O]                | no                      | Replicar                                 |
| ⌘D                                             | nada [O]                    | duplica                 | Mantener                                 |
| alinear y distribuir                           | sí en barra [O]             | no                      | Replicar                                 |
| marco de selección múltiple                    | 3 px acento 30 % [O]        | no                      | Replicar                                 |
| crear tarjeta con doble clic                   | 250 por 60 en edición [O]   | 250 por 60              | Mantener; verificar que entra en edición |
| ⌘ y arrastrar crea tarjeta del tamaño dibujado | sí [D]                      | no                      | Replicar, prioridad baja                 |
| conectar en vacío crea tarjeta                 | no observado                | sí                      | Mantener                                 |
| pegar                                          | cerca del ratón [O]         | desplazado 40           | Replicar                                 |

## Menús

| menú      | solo Obsidian                                                                     | solo DayliOS                   |
| --------- | --------------------------------------------------------------------------------- | ------------------------------ |
| fondo     | nota de la bóveda, página web, ajustar a rejilla, ajustar a objetos, solo lectura | imagen, grupo vacío, encuadrar |
| nodo      | convertir a archivo                                                               | forma                          |
| conexión  | seguir conexión                                                                   | flechas y etiqueta en la barra |
| selección | alinear                                                                           | encuadrar                      |

Decisión: Replicar las opciones de Obsidian sin quitar las de DayliOS.

## Visual

| elemento          | Obsidian [O]                                  | DayliOS                        | decisión                    |
| ----------------- | --------------------------------------------- | ------------------------------ | --------------------------- |
| fondo             | `#1C1C1C`                                     | rgb 30, 30, 30                 | Replicar                    |
| puntos            | `#333333`                                     | `#3a3a3a`                      | Replicar                    |
| borde de tarjeta  | 1 px `#7e7e7e`                                | 2 px `#4a4a4a`                 | Replicar                    |
| sombra de tarjeta | `rgba(0,0,0,.1) 0 .5px 1px .5px`              | ninguna                        | Replicar                    |
| relleno de texto  | 0 16 px                                       | 12 por 20 px                   | Replicar                    |
| fuente            | 16 px, 24 px interlineado                     | igual                          | Mantener                    |
| selección         | borde 1 px acento y anillo 2 px               | anillo 2 px acento, borde 2 px | Replicar                    |
| tarjeta con color | borde y sombra interior al 70 %, fondo teñido | borde de color, fondo al 8 %   | Replicar                    |
| conexión          | 2 px en pantalla, gris `#7e7e7e`              | 2 px de lienzo, `#8c8c8c`      | Replicar                    |
| etiqueta de grupo | peso 400, `#b3b3b3`, fondo gris 10 %          | peso 600, 18 px                | Replicar                    |
| controles         | ajustes, restablecer, ayuda                   | minimapa, porcentaje           | Extender: añadir sin quitar |

## Contenido

| tipo                                     | Obsidian [O]                                | DayliOS           | decisión                   |
| ---------------------------------------- | ------------------------------------------- | ----------------- | -------------------------- |
| texto                                    | markdown con vista previa en vivo al editar | textarea crudo    | Replicar edición inline    |
| formato de texto                         | markdown: negrita, cursiva                  | ninguno           | Replicar con markdown      |
| fuente, tamaño, alineación, interlineado | no existe                                   | no existe         | Extender en meta `daylios` |
| nota                                     | markdown de la nota                         | título y markdown | Mantener; añadir `subpath` |
| imagen                                   | sí                                          | sí                | Mantener                   |
| PDF                                      | visor con páginas en la tarjeta             | icono             | Replicar                   |
| web                                      | página en vivo                              | host y URL        | Replicar, D3               |
| fondo de grupo                           | sí [D]                                      | no                | Replicar                   |

## Rendimiento

DayliOS iguala o supera las cifras de Obsidian en los escenarios medidos. La diferencia de rango de
zoom impide comparar grande en fit. No hay motivo medido para cambiar React Flow.
