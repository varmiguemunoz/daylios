# Tareas · Automatizaciones

Al terminar cada fase: `npm run check` en cero.

## Fase A · Dominio

- [x] 1. `src/shared/automations/model.ts`, `conditions.ts` y `template.ts`
- [x] 2. `catalog.ts`: `TRIGGERS` de R3 y `NODES` de R4 y R5 con `ParamSpec`, puertos, salidas y
      frases
- [x] 3. `graph.ts`: insertar, borrar nodo, borrar rama, `move`, `canMove`, `slots`, `clone`,
      `upstream`, `pathTo` y `layout`
- [x] 4. `validate.ts` y `describe.ts`
- [x] 5. Tests del dominio y del layout

## Fase B · Datos, eventos y motor

- [x] 6. Migración `AddAutomations`, modelos y `data-source`. En `edition.ts`: `SYNC_TABLES`,
      `SOFT_DELETE_TABLES` y `NEVER_SYNC`
- [x] 7. `events.ts` con `emit` y `withCause`; emisión en `contact`, `prospect`, `client`, `task`,
      reuniones y `hub-sync`
- [x] 8. `cache.ts`, `enroll.ts` con el log de triggers, y `runner.ts`
- [x] 9. `engine.ts`: tick, kick, recuperación, `late`, purga. Se arranca y se detiene en
      `index.ts`
- [x] 10. Tests del motor con `Clock` falso, y el test de sincronización sin eventos

## Fase C · Nodos

- [x] 11. Puertos `EmailPort`, `HttpPort` y `NotifierPort`, con su omisión cuando no están
      configurados
- [x] 12. Ayudantes con `manager`: `moveProspect`, `insertTaskWithRoom`, `insertNote`,
      `removeProspect` y `removeContact`
- [x] 13. Handlers de control: `if_else`, `wait`, `go_to` y `finish`
- [x] 14. Handlers de dominio de R5, más el test de que el registro está completo

## Fase D · Servicio, API y migración de Reglas

- [x] 15. `AutomationService` completo, con dry run y referencias
- [x] 16. Rutas, controlador, IPC, preload y `onChanged`
- [x] 17. Migrar reglas a automatizaciones en la migración, con test. Quitar `runRules`,
      `RuleModel`, `rule.service`, `Rules.tsx`, rutas, IPC, MCP y el flag `rules` de `changeTags`
- [x] 18. Worker `leads-hub` sin reglas y `HubConfig` sin `rules`; se aceptan ítems viejos
- [x] 19. Servidor `services/cloud`: tablas nuevas aceptadas y `describeChange` para
      `automations`

## Fase E · UI

- [x] 20. Pantalla `Automations` y la sección en `sections.ts`, en lugar de Reglas
- [x] 21. Editor: `Canvas`, `NodeCard`, `TriggerCard`, `AddButton`, `useTreeDrag` y
      `useAutomationDraft` con autoguardado, deshacer y rehacer; copiar y pegar
- [x] 22. `NodePicker`, `NodePanel`, `ParamField`, `BranchesEditor`, `ConditionRow` y
      `VariableMenu`
- [x] 23. Barra de publicar, con validación, versiones y restaurar, y la pestaña Ajustes
- [x] 24. `RunsTable`, `StepsTable`, modo stats con camino resaltado, y `TestDrawer`
- [x] 25. Sección «Automatizaciones» en las fichas de contacto, prospecto y cliente
- [x] 26. Pasada de `critique` de impeccable sobre el editor y corrección en un lote

## Fase F · MCP y documentación

- [x] 27. `src/mcp/tools/automations.ts`, con R12
- [x] 28. README, DESIGN.md y ROADMAP. `internal-automations/STATUS.md` remite a este spec

## Checklist manual

- [ ] Las reglas existentes aparecen como automatizaciones con el mismo estado
- [ ] «Tag webinar → esperar 2 min → email → tag nurture»: un lead del webhook recibe el email a
      los 2 min y queda con `nurture`
- [ ] If/Else con dos ramas que se cumplen a la vez toma la primera; sin ninguna, toma None
- [ ] «Esperar hasta que tenga el tag cliente, timeout 1 día»: añadir el tag saca la ejecución por
      `met` al instante
- [ ] Cierro la app durante una espera de 5 min y la abro a los 10: corre y queda «con retraso»
- [ ] Un webhook a una URL que da 500 se reintenta a 1, 5 y 30 min y luego falla. «Reintentar»
      lo vuelve a correr
- [ ] Publico la v2 con una ejecución esperando en la v1: esa ejecución sigue la v1
- [ ] A añade el tag B y B añade el tag A: no entran en bucle y el log muestra `loop_limit`
- [ ] En Team, un cambio que hace el otro Mac no dispara nada en el mío
- [ ] «Probar» no cambia nada en la base
- [ ] Claude crea y publica una automatización con `list_automation_catalog`,
      `save_automation_draft` y `publish_automation`
- [ ] Arrastro un If/Else con sus ramas a otro hueco y el árbol se reacomoda; arrastrarlo dentro de
      su propia rama no se permite
- [ ] Arrastro una acción del catálogo directo a un hueco
- [ ] Añadir un nodo de prueba toca solo `catalog.ts` y su handler
