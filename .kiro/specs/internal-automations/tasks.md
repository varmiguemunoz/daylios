# Tareas · Automatizaciones internas

## Fase A · Dominio

- [ ] 1. `src/shared/automations.ts`: tipos, catálogo (`TRIGGERS`, `CONDITIONS`, `ACTIONS` con
      `ParamSpec`), `matchesTrigger`, `evaluate`, `render`, `validateAutomation`, `describe`,
      `subjectOf`
- [ ] 2. Tests puros del dominio (coincidencia por tag/etapa, condiciones, variables vacías, acciones
      incompatibles con `task.completed`, destructiva exige confirmación)

## Fase B · Datos y motor

- [ ] 3. Migración `AddAutomations` (tablas, conversión de reglas, `DROP rules`) + modelos
- [ ] 4. Emisión de eventos en servicios (ver foundations): contactos, tags, estado, prospectos,
      clientes, reuniones, tareas
- [ ] 5. `enqueue.ts` (reentrada, profundidad, dedupe) registrado con `onEvent`
- [ ] 6. `engine.ts` (tick, recuperación, esperas, backoff, `late`) arrancado en `index.ts`
- [ ] 7. Ayudantes extraídos para usar con `manager`: `moveProspect`, `insertTaskWithRoom`,
      `insertNote`, `removeProspect`, `removeContact`

## Fase C · Acciones

- [ ] 8. Puertos `EmailPort` (Resend + `marked` + pie de baja), `NotifierPort`, `HttpPort`
- [ ] 9. Handlers: contacto (1–10), pipeline (11–14), clientes (15–16), email (17–19), productividad
      (20–22), integraciones (23)

## Fase D · Servicio, API y Worker

- [ ] 10. `AutomationService` (CRUD, runs, cancelar, simulación, manual, `references`)
- [ ] 11. Controlador, rutas `/automations`, IPC `automations:*`, preload `window.api.automations`
- [ ] 12. Quitar reglas: `runRules`, `RuleModel`, `rule.service(+test)`, `Rules.tsx`, rutas, IPC,
      MCP; `HubConfig` sin `rules`; `hub-sync` emite eventos; compatibilidad con ítems viejos
- [ ] 13. Worker `leads-hub`: sin reglas, `audience`; tests del Worker actualizados

## Fase E · UI

- [ ] 14. `Automations` (lista + ejemplos de un clic) y barra lateral «Automatización»
- [ ] 15. Editor: `TriggerCard`, `ConditionList`, `StepList`, `StepCard`, `StepPicker`, `ParamField`,
      `VariableChips`; guardar con validación
- [ ] 16. `RunsTable`, `TestDrawer`; sección en la ficha de contacto y «Ejecutar automatización»
- [ ] 17. impeccable `critique` del editor; corregir en un lote

## Fase F · MCP y docs

- [ ] 18. MCP: catálogo, CRUD, estado, prueba, manual, ejecuciones, cancelar
- [ ] 19. README (automatizaciones, redeploy del Worker), DESIGN.md (editor y lista)

## Checklist

- [ ] Las reglas que tenía aparecen como automatizaciones pausadas/activas iguales
- [ ] «Cuando entra el tag webinar → esperar 2 min → enviar email → añadir tag nurture»: un lead del
      webhook con `webinar` recibe el email a los 2 min y queda con `nurture`
- [ ] «Prospecto pasa a Contract Sent → crear tarea "Llamar a {{prospect.company}}" mañana»: aparece
      la tarea en el día correcto (o el siguiente con hueco)
- [ ] Cierro la app durante una espera de 5 min, la abro 10 min después: el paso se ejecuta y la
      ejecución muestra «con retraso»
- [ ] A con «añadir tag B» y B con «añadir tag A» no entran en bucle
- [ ] «Probar con un contacto» no cambia nada en la base
- [ ] Claude crea una automatización completa con `list_automation_catalog` + `save_automation`
