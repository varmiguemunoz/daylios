# Roadmap v3 · DayliOS

Plan por módulos (SDD). Cada módulo tiene su carpeta con `requirements.md`, `design.md` y `tasks.md`.
Se implementa en orden; cada módulo se aprueba antes de empezar.

## Decisiones confirmadas con el dueño (13 oct 2026)

- Subtareas: **un nivel**, sin límite de cantidad, **no cuentan** para el techo de 8.
- Pipelines: **varios**, con selector (como Apollo).
- Automatizaciones: corren **en la app local** (Mac encendido). Lo vencido se pone al día al abrir.
  El Worker solo recibe leads.
- Pantalla de tags: **contactos y tareas**.
- Se mantiene la regla de la casa: **solo opt-in**. Las automatizaciones solo envían email de
  marketing a contactos `subscribed`.
- El plan del sistema de leads (Lead Intelligence) queda guardado en el proyecto de Claude para
  después. Fuera de este roadmap.

## Ajustes del dueño (13 oct, 10:11)

- Un contacto **sí puede** pertenecer a un cliente y a un prospecto. Se mantienen ambos vínculos;
  solo mejora la UX/UI de esos selectores.
- Tags audiencia: aprobado.
- **Módulo 7 aplazado** a una sesión propia (automatizaciones tipo GHL). El bus de eventos de
  `foundations` también pasa al 7 (sin consumidor no se construye). Las Reglas siguen como hoy.
- Pulsación para arrastrar el pipeline: **500 ms** (no 2 s).
- Redespliegue del Worker: aprobado (lo pide el módulo 2 por `audience`).

## Módulos y orden

| #   | Carpeta                | Qué resuelve                                                         | Depende de |
| --- | ---------------------- | -------------------------------------------------------------------- | ---------- |
| 0   | `foundations`          | Eventos de dominio, primitivas UI (Drawer, Modal…), MCP modular      | —          |
| 1   | `subtasks`             | Funcionalidad 1: subtareas                                           | 0          |
| 2   | `tags-admin`           | Funcionalidad 2: ver, renombrar y borrar tags (contactos y tareas)   | 0          |
| 3   | `note-relations`       | Arreglo 1: notas relacionadas + notas ↔ clientes                     | 0          |
| 4   | `clients-admin`        | Arreglo 2: borrar clientes y proyectos, editar y borrar documentos   | 3          |
| 5   | `contacts-ux`          | Arreglo 3: filtros en panel, ficha nueva, contacto → prospecto       | 0, 2, 6\*  |
| 6   | `multi-pipeline`       | Arreglo 4: varios pipelines, columnas/lista, editor, navegación      | 0          |
| 7   | `internal-automations` | Arreglo 5: **aplazado** a sesión propia                              | 0, 2, 6    |
| 8   | `mcp-full-coverage`    | Arreglo 6: Claude puede hacer todo lo que hace la UI                 | todos      |
| 9   | `task-detail-minimal`  | Detalle sin ruido: editor sin modos, panel lateral, subtareas en Hoy | 1          |

\* `contacts-ux` usa el selector de pipeline de «Convertir en prospecto»; si se hace antes que 6,
el modal elige solo etapa y se amplía en 6. Orden de esta sesión: 0 → 1 → 2 → 3 → 4 → 6 → 5 → 8.

## Patrón (igual que hoy, en todos los módulos)

1. Tipos y contrato en `src/shared/*.ts` (puros, sin Node ni DOM).
2. Modelo `EntitySchema` + migración nueva **al final** de `MIGRATIONS` (nunca editar una publicada).
3. Servicio en `src/main/services`: validación con `AppError`, escrituras dentro de
   `transactionGuard`, ayudantes exportados que reciben el `EntityManager` de la transacción.
4. Controlador + ruta Express (API local que usa el MCP).
5. IPC (`ipc*.ts`) + preload (`window.api.*`) para la UI.
6. Herramienta MCP en `src/mcp/tools/<dominio>.ts`.
7. UI con diseño atómico: `atoms/`, `molecules/`, `organisms/` en `src/renderer/src/consultora/ui/`
   (y `components/` en la ventana del menubar), componentes por props, sin lógica de datos dentro.
8. Diseño con impeccable: brief por pantalla en cada `design.md`; `craft-floor.md` antes de editar UI.

Código simple y legible, comentarios de una línea. Tests solo de funciones puras (se escriben, no
se ejecutan aquí: los corre el dueño).

## Migraciones nuevas (en este orden)

1. `AddSubtasks1728200000000`
2. `AddTagAudience1728300000000`
3. `AddNoteRelations1728400000000`
4. `AddContactProject1728500000000`
5. `AddPipelines1728600000000`
6. `AddAutomations1728700000000` (módulo 7, aplazado)

## Cambios de producto (PRODUCT.md / DESIGN.md)

- PRODUCT.md: entran subtareas, búsqueda mínima de notas (para relacionarlas), varios pipelines y un
  constructor **lineal** de automatizaciones (lista vertical de pasos, no lienzo).
- DESIGN.md: nuevos componentes Drawer, Modal, control segmentado, botón de filtros, fila de
  subtarea, tarjeta de paso de automatización, tablero/lista de pipeline.

## Verificación (la hace el dueño)

`npm install` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run service:install` ·
reiniciar Claude (⌘Q) para cargar las herramientas MCP nuevas · checklist de cada `tasks.md`.
Tras el módulo 2 hay que **redesplegar el Worker** (`workers/leads-hub`): `cd workers/leads-hub && npm run deploy`.
