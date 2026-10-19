# Tareas

Cada bloque termina con `npm run check` en cero errores. Pruebas en `src/test`, ayudantes en
`src/main/test`. Código nuevo sin comentarios. No se crean ramas ni se hace commit.

## Fase 0 · Decisiones y cuentas, las hace el dueño

- [ ] 0.1 Decidir el modelo de consentimiento para contactos fríos de outreach: usar el estado
      `none` con supresión global, o añadir un estado propio. Define R8.3. Si prospectas fuera de
      Estados Unidos, indicarlo, porque cambia la regla.
- [ ] 0.2 Generar la clave API maestra de Apollo y guardarla solo en Ajustes, nunca en el repo.
- [ ] 0.3 Comprar 2 o 3 dominios secundarios, crear sus buzones en Google Workspace, conectarlos a
      Apollo y activar el calentamiento. Configurar SPF, DKIM y DMARC en cada uno.
- [ ] 0.4 Redactar el pie de outreach con la dirección física que se mostrará en cada correo.
- [ ] 0.5 Antes de habilitar SES para frío, leer su política de uso aceptable. Mientras tanto
      queda con `coldOutreach: false`.

## Fase 1 · Capa y Resend, refactor sin cambio de comportamiento

- [x] 1. Crear `src/shared/email-delivery` con dominio, puertos, errores, `canReceive`, registro y
      router. Pruebas: tabla de verdad de `canReceive`, clasificación de errores, router con rol
      sin asignar, capacidad no soportada y política violada
- [x] 2. Reglas ESLint de frontera: `domain`, `ports` y `application` no importan `resend`,
      `electron`, `typeorm` ni `../providers`. Nada fuera de la capa importa `providers/*`
- [x] 3. `providers/resend`: mover el código de `resend-gateway.ts` partido por capacidad, con
      `ResendApi` inyectable, limitador de 110 ms y mapeo a `EmailProviderError`. Mover `buildDraft`
      y el armado de templates a `sequences.ts`, y `toStatuses` a `events.ts`
- [x] 4. `FakeProvider` y `runProviderContract` en `src/main/test/email-delivery`. Ejecutar la suite
      contra el fake y contra el adaptador de Resend con stub
- [x] 5. Migrar `newsletter.service` y sus pruebas
- [x] 6. Migrar `sequence.service` para que arme un `SequenceDraft`, y sus pruebas
- [x] 7. Migrar `marketing-sync` y `marketing.ts`, con `find('marketing')` en lugar del gateway
      nullable, y sus pruebas
- [x] 8. Migrar `automations/adapters.ts` a `deliveryEmail`, con roles por nodo
- [x] 9. Crear `src/main/email.ts` que arma registro, router y credenciales desde `config`, y
      conectarlo en `index.ts`
- [x] 10. Migrar el Worker `leads-hub` a `AudienceStore`, `SequenceEngine` y
      `DeliveryEventSource`, sin cambiar el formato de cable ni las rutas. Actualizar
      `hub.test.ts`
- [x] 11. Servicio cloud: `delivery-mailer.ts`, `invite-mail.ts`, `MAIL_PROVIDER`, tsconfig y
      dependencia. Verificar con `npm install` en `services/cloud` y `npm run check`
- [x] 12. Borrar `resend-gateway.ts`, `resend.provider.ts` y `fake-resend.ts`. Confirmar con una
      búsqueda que `resend` solo se importa dentro de `providers/resend`

## Fase 2 · Configuración y ajustes

- [x] 13. `config.ts` y `consultora.ts`: `emailRoles`, `providerCredentials`, validación de política
      al guardar, migración suave desde `resendApiKey`. Pruebas
- [x] 14. Al cambiar el proveedor de audiencia, invalidar `segment_id` y `synced_at` y reencolar.
      Prueba con dos proveedores fake
- [x] 15. UI Ajustes de email en diseño atómico: tarjeta de proveedor con estado y «Probar»,
      selector de rol, componentes con props
- [x] 16. `get_marketing_status` y las herramientas MCP muestran el proveedor activo por rol. Textos
      genéricos donde ya no son exclusivos de Resend
- [x] 17. `edition.ts`: sumar `apolloApiKey` a `NEVER_SYNC.settings`

## Fase 3 · Apollo para outreach

- [~] S1. Spike con cuenta real y una secuencia desechable e inactiva: crear secuencia por REST, pausar
      una secuencia, inscribir con varios buzones, campos devueltos por `emailer_messages/search`,
      existencia de webhooks, límites reales del plan Basic. Resultado en
      `adr/ADR-01-apollo.md`. Decide `authoring`
- [x] 18. `providers/apollo`: cliente HTTP con reintentos y 429, `AudienceStore` con etiquetas,
      `SequenceEngine` según el ADR, `DeliveryEventSource` en modo pull. Pruebas con `fetch`
      inyectado y la suite de contrato
- [x] 19. Registrar Apollo con `coldOutreach: true`. Prueba de que Resend no puede asignarse a
      `outreach`
- [x] 20. Sin migración: el tope devuelve `deferred` y el cursor vive en ajustes. Ver diseño, cambios 7 y 8
- [x] 21. `outreach.service`: elegibilidad, tope diario con goteo, pie obligatorio y activación con
      confirmación. Pruebas
- [x] 22. Sincronización de eventos por pull cada pocos minutos: supresión global, línea de tiempo,
      tarea por respuesta de interés y promoción opcional al pipeline. Pruebas
- [x] 23. Pantalla Outreach mínima: secuencias, inscritos, respuestas, estado y tope. Diseño atómico
- [x] 24. Herramientas MCP: listar secuencias de outreach, inscribir contactos, activar con
      confirmación, resumen de respuestas

## Fase 4 · Cierre

- [x] 25. `email-delivery/README.md` con la guía de cuatro pasos y la lista de entregabilidad
- [x] 26. Actualizar `README.md`, `DESIGN.md`, `PRODUCT.md` y los specs que citan Resend como único
      proveedor
- [x] 27. Verificación final: búsqueda de imports prohibidos, `npm run check` y pruebas completas

## Checklist de punta a punta, con cuentas reales

- [ ] Resend sigue enviando una invitación, una copia de prueba y un newsletter a un tag de prueba
- [ ] El webhook de Resend sigue marcando una baja y un rebote en la app
- [ ] Ajustes: «Probar» en verde para Resend y para Apollo
- [ ] Intentar asignar Resend a `outreach` da un error claro
- [ ] Una secuencia nueva en Apollo se crea inactiva y no envía hasta confirmar
- [ ] Inscribir 10 contactos de prueba respeta el tope y sale desde los buzones conectados
- [ ] Una respuesta de prueba aparece como evento y crea la tarea
- [ ] Una baja de prueba suprime al contacto en marketing y en outreach

## Definición de hecho

1. Ningún consumidor importa de `providers/*` ni del SDK `resend`.
2. Sumar un proveedor nuevo no modifica dominio, puertos ni consumidores.
3. Las suites existentes pasan con las mismas aserciones.
4. `npm run check` en cero errores.
