# Requisitos · W2 Notas en la bóveda

## R1 · Un solo sistema de notas

- R1.1 Toda nota es un archivo `.md` de la bóveda. El título es la primera línea, como hoy.
- R1.2 El menubar sigue igual por fuera: la pestaña Notas lista las notas de `Notas rápidas/`,
  la más reciente arriba, y su buscador busca en toda la bóveda.
- R1.3 Una nota nueva del menubar, y las notas de voz, se guardan en `Notas rápidas/` con nombre
  `AAAA-MM-DD título.md`. Si el título cambia, el archivo se renombra al salir de la nota.
- R1.4 Las relaciones entre notas y con clientes siguen funcionando por id, para cualquier nota de
  la bóveda.

## R2 · Migración

- R2.1 Al primer arranque, cada nota de la tabla `notes` se escribe como archivo en
  `Notas rápidas/` con su fecha original y conserva su id.
- R2.2 La tabla vieja queda como `notes_legacy`, sin borrar.
- R2.3 Si la migración falla a medias, se reintenta en el siguiente arranque sin duplicar notas.

## R3 · Editor

- R3.1 Mismo editor sin modos del menubar: doble clic edita, vuelve a lectura solo.
- R3.2 Autoguardado. Indicador de guardando y de error.
- R3.3 Si el archivo cambió fuera mientras lo editabas, no se pisa: aviso con «Recargar» o
  «Guardar mi versión».
- R3.4 Pegar o arrastrar una imagen dentro de una nota la guarda en `Adjuntos/` y añade
  `![](ruta)` en el cursor. Las imágenes se ven en lectura.
- R3.5 Crear, renombrar, mover y borrar notas desde el workspace y desde el menubar.

## Fuera de alcance

- Enlaces `[[wikilink]]` y vista de grafo.
