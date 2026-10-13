# Diseño · Fundamentos v3

## Eventos de dominio

`src/shared/events.ts` (puro):

```ts
export type DomainEvent =
  | { type: 'contact.created'; contactId: string; source: string | null }
  | { type: 'contact.tag_added'; contactId: string; tag: string }
  | { type: 'contact.tag_removed'; contactId: string; tag: string }
  | { type: 'contact.status_changed'; contactId: string; from: ContactStatus; to: ContactStatus }
  | { type: 'prospect.created'; prospectId: string; pipelineId: string; stageId: string }
  | { type: 'prospect.stage_changed'; prospectId: string; pipelineId: string
      fromStageId: string; toStageId: string; kind: StageKind }
  | { type: 'client.created'; clientId: string }
  | { type: 'meeting.ready'; meetingId: string }
  | { type: 'task.completed'; taskId: string; tags: string[] }

export interface EventEnvelope { id: string; at: string; event: DomainEvent; cause: EventCause | null }
export interface EventCause { runId: string; automationId: string; depth: number }
```

`src/main/events/bus.ts`:

```ts
type Handler = (manager: EntityManager, e: EventEnvelope) => Promise<void>
export function onEvent(handler: Handler): () => void          // registra (lo usa el motor de automatizaciones)
export async function emit(manager: EntityManager, event: DomainEvent): Promise<void>
export function afterCommit(manager: EntityManager, fn: () => void): void // corre al confirmar
```

- La causa sale de `AsyncLocalStorage` (`src/main/events/cause.ts`): el motor ejecuta cada paso con
  `withCause({ runId, automationId, depth }, fn)` y `emit` la lee sola. Así no hay que pasar un
  parámetro extra por todos los servicios.
- `emit` llama a los handlers en orden con el mismo `manager` (misma transacción).
- `afterCommit`: `WeakMap<EntityManager, (() => void)[]>`. `transactionGuard` crea la lista al abrir
  la transacción y la ejecuta al confirmar; en rollback se descarta. Sirve para despertar el motor.

Puntos de emisión (se añaden en los módulos que los tocan, aquí solo la infraestructura):

| Evento                  | Dónde                                                      |
| ----------------------- | ---------------------------------------------------------- |
| contact.created         | `ContactService.create`, `hub-sync.applyLead` (nuevo)      |
| contact.tag_added/removed | `changeTags` (por cada slug añadido/quitado)             |
| contact.status_changed  | `setStatus`, `subscribe`, `unsubscribe`                     |
| prospect.created        | `insertProspect`                                           |
| prospect.stage_changed  | `ProspectService.move` (solo si cambia de etapa)           |
| client.created          | `insertClient`                                             |
| meeting.ready           | `meeting.service` al pasar a `ready`                       |
| task.completed          | `TaskService.update` cuando `done` pasa a true             |

## Primitivas de UI

Estructura (los existentes de `ui.tsx` se quedan donde están; `ui.tsx` re-exporta lo nuevo para no
tocar imports):

```
src/renderer/src/consultora/ui/
  atoms/      IconButton.tsx  CountBadge.tsx  Kbd.tsx
  molecules/  ConfirmButton.tsx  SegmentedToggle.tsx  SearchField.tsx  FilterButton.tsx
  organisms/  Drawer.tsx  Modal.tsx
  index.ts    barrel
```

- `Drawer({ open, title, onClose, children, footer? })`: 360px, alto completo bajo la barra superior,
  surface, radio xl en el lado izquierdo, sombra «toast float» (mismo uso permitido que la hoja de
  grabación), entra deslizando 16px desde la derecha (320ms expo). Fondo: night al 40%.
- `Modal({ open, title, onClose, children, actions, size: 'sm' | 'md' | 'lg' })`: surface, radio xl,
  sombra toast float, foco atrapado, `role="dialog"` `aria-modal`.
- `SegmentedToggle<T>({ value, options: {id,label,icon?}[], onChange })`: rail del tab switcher,
  32px items, radiogroup.
- `FilterButton({ count, onClick })`: pill quiet «Filtros»; con count > 0 muestra `CountBadge`
  apricot con ink.
- `ConfirmButton({ label, confirmLabel, onConfirm, tone: 'rose' })`: extrae el patrón de borrar en
  dos pasos (se resetea al salir).
- `SearchField({ value, onChange, placeholder, autoFocus? })`.

Brief impeccable (modo Operate): las primitivas son la gramática común; calma por defecto, una sola
superficie flotante a la vez, Esc siempre cierra lo último abierto.

## MCP modular

```
src/mcp/
  client.ts            api(), tool(), query(), day (zod)
  index.ts             new McpServer → register(server) de cada módulo → stdio
  tools/
    tasks.ts  notes.ts  clients.ts  meetings.ts  pipeline.ts  contacts.ts
    marketing.ts  (sources, sequences, newsletters, tags)
    automations.ts (módulo 7)
```

Cada módulo: `export function register(server: McpServer): void`. Mover código tal cual.
