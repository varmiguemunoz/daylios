# Spike · Motor de PDF, D4

Fecha: 14 de octubre de 2026. Código y capturas en `.rea-evidence/pdf-spike/`. Se ejecutó fuera del
repo, en `/tmp/pdf-spike`, con el Electron del proyecto. No se tocó la app.

## Montaje

- Ventana de 1024 por 800, `sandbox: false` como la app, página `file://` con la CSP de la app más
  `frame-src vault:`, `connect-src 'self' vault:` y `worker-src 'self'`.
- Esquema `vault` registrado igual que en `src/main/index.ts`.
- Documentos generados con `scripts/perf/pdf.mts`: 2 páginas y 300 páginas.
- 1 y 10 tarjetas de 320 por 420, dos repeticiones por caso.
- **A** iframe con el visor PDF de Chromium. **B** `pdfjs-dist` 6.4.299 renderiza la página 1 en
  un canvas a la resolución de la pantalla.

## Resultados

| caso | A tiempo ms | A memoria MB | A procesos | B tiempo ms | B memoria MB | B procesos |
|---|---|---|---|---|---|---|
| 2 páginas, 1 | 90 a 94 | 659 a 679 | 7 | 115 a 146 | 412 a 418 | 4 |
| 2 páginas, 10 | 131 a 140 | 1689 a 1745 | 16 | 152 a 220 | 576 a 580 | 4 |
| 300 páginas, 1 | 83 a 163 | 691 a 692 | 7 | 123 a 128 | 425 | 4 |
| 300 páginas, 10 | 128 a 140 | 1830 a 1841 | 16 | 206 a 237 | 597 a 636 | 4 |

- Memoria: suma de `workingSetSize` de todos los procesos de la app.
- Tiempo A es el evento `load` del iframe, no la pintura. Tiempo B es el canvas ya pintado. A está
  favorecido en la comparación.
- Longtasks en la página: 0 en los dos casos. A con 300 páginas tuvo un frame de 51 y otro de 67 ms.
  B no tuvo frames de más de 50 ms.

Coste por tarjeta extra, de 1 a 10: A unos 115 MB y un proceso más por PDF; B unos 18 MB y ningún
proceso.

## Hallazgos

1. A funciona en Electron 39 con `vault://` sin activar `plugins`. Muestra la barra de Chromium con
   descargar e imprimir, sin control de estilo.
2. `pdfjs-dist` 6.4 usa `Map.prototype.getOrInsertComputed`, que el Chromium de Electron 39 no
   tiene. Funciona con la compilación `legacy`.
3. `fetch` de `vault://` desde la página falla sin `corsEnabled` en el esquema y sin cabecera CORS.
   Abrir CORS en `vault` dejaría que cualquier origen, también una web incrustada, lea la bóveda. Se
   descarta: los bytes llegan por IPC.
4. Tamaño: `pdf.min.mjs` legacy 524 KB y `pdf.worker.min.mjs` legacy 1.3 MB. Carga diferida, solo
   cuando hay un PDF en pantalla.
5. `pdfjs-dist` trae `@napi-rs/canvas` como opcional para Node. Va en `devDependencies` como el resto
   de librerías del renderer, así que electron-builder no lo empaqueta.

## Decisión D4

**B, `pdfjs-dist` 6.4.299 exacto, compilación legacy.**

- Unas 6 veces menos memoria por tarjeta y sin procesos extra.
- Sin frames largos durante la carga.
- Control total del aspecto: miniatura, paginación y vista ampliada con los tokens del board.
- Miniatura reutilizable al alejar.

Condiciones:

- Bytes por IPC con `vault.safe` y límite de tamaño. Sin cambios en el esquema `vault`.
- `isEvalSupported: false`, sin scripting ni XFA.
- CSP: `worker-src 'self'`. No hace falta `frame-src` para PDF.
