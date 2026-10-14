# ADR-05 · Edición simultánea de notas y boards

- Estado: aprobado
- Fecha: 13 oct 2026
- Módulo: N0, construyen N3 y N4

## Contexto

Notas `.md` y boards `.canvas` viven como archivos en la bóveda, indexados en SQLite. Dos personas
del equipo pueden editar el mismo archivo a la vez o sin conexión. Fusionar por campo como en
ADR-02 no sirve para un texto largo. Un CRDT letra a letra es lo ideal, pero es mucho trabajo y ya
quedó como V2 de N5.

## Opciones

| Opción                                 | Cómo funciona                                                                                                                                                                                                  | A favor                                                       | En contra                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| A · Último gana con copia de conflicto | Cada archivo guarda la revisión base con la que se empezó a editar. Si al subir la revisión del servidor ya no es esa, no se pisa nada: se guarda una copia «Nota, conflicto de Ana 14 oct» junto al original. | Simple, no se pierde nada, igual que Obsidian Sync y Dropbox. | La fusión es manual. Con muchas ediciones a la vez aparecen copias.         |
| B · Fusión de tres vías para texto     | Con la base, la versión local y la remota, se fusionan los cambios por líneas. Si chocan en la misma línea, copia de conflicto.                                                                                | Casi siempre fusiona solo.                                    | Fusiones de texto que parecen correctas y no lo son. Más código que probar. |
| C · CRDT con Yjs                       | Cada nota y board es un documento Yjs que se sincroniza en tiempo real.                                                                                                                                        | Edición simultánea real con cursores.                         | Cambia cómo se guardan los archivos y el editor. Fuera del alcance de V1.   |

## Criterios

| Criterio                                          | Peso | A      | B      | C      |
| ------------------------------------------------- | ---- | ------ | ------ | ------ |
| Nunca se pierde lo escrito                        | 3    | 5      | 4      | 5      |
| Simple de construir y probar                      | 3    | 5      | 3      | 1      |
| Funciona sin conexión                             | 2    | 5      | 5      | 4      |
| Los archivos siguen siendo .md y .canvas legibles | 2    | 5      | 5      | 2      |
| Comodidad al editar a la vez                      | 1    | 2      | 3      | 5      |
| **Total ponderado**                               |      | **52** | **44** | **35** |

## Decisión

V1 con la opción A para notas. Para boards, una mejora sin coste extra: JSON Canvas ya trae ids por
tarjeta y por conexión, así que se fusiona tarjeta por tarjeta con la regla de ADR-02. Solo si la
misma tarjeta cambió en los dos lados se crea la copia de conflicto del board.

- Nombre de la copia: `<nombre>, conflicto de <persona> <fecha>.md`, en la misma carpeta.
- La app avisa con un aviso en la nota original y un enlace a la copia.
- V2: Yjs para notas y boards, como parte de N5.

## Consecuencias

- Nada se pierde y los archivos siguen abriéndose en Obsidian.
- Puede haber copias si dos personas editan la misma nota a la vez. Se mitiga con la presencia de
  N5: la nota muestra quién la tiene abierta.
- Para pasar a Yjs más adelante hay que cambiar el formato guardado y el editor, no el motor de
  ADR-02.
