# email-delivery

Capa de proveedores de email de Alisuite. Spec: `.impeccable/.kiro/specs/email-delivery-providers/`.

## Reglas

1. `domain`, `ports`, `application` e `index.ts` no importan SDKs, Node, Electron ni otros módulos. ESLint lo impone.
2. Los consumidores importan solo desde `@shared/email-delivery`.
3. Solo las raíces de composición importan `providers/*`: `src/main/email.ts`, `workers/leads-hub/src/index.ts` y `services/cloud/src/app.module.ts`.
4. Un proveedor expone solo las capacidades que soporta: `sender`, `audience`, `sequences`, `broadcasts`, `events`.
5. Tres roles: `transactional`, `marketing` y `outreach`. El router rechaza `outreach` en un proveedor con `coldOutreach: false`.

## Proveedores

| Proveedor | Capacidades | Correo en frío | Envía desde |
| --- | --- | --- | --- |
| Resend | send, audience, sequences por evento, broadcasts, events por webhook | no | dominio verificado |
| Apollo | sequences por inscripción, events por consulta | sí | buzones conectados en Apollo |

## Cómo añadir un proveedor

1. Crea `providers/<id>/` con un `create<Id>Provider(credentials)` que devuelva un `EmailProvider` con su `ProviderInfo`, política, límites y solo los puertos que soporta.
2. Traduce sus errores a `EmailProviderError` con el `kind` correcto: `fatal`, `retryable` o `rejected`.
3. Suma el literal a `PROVIDER_IDS`, registra su descriptor en `src/main/email.ts` y su clave en `config.ts` y en `NEVER_SYNC.settings`.
4. Pasa `runProviderContract` de `src/main/test/email-delivery-contract.ts` con un cliente HTTP falso y escribe las pruebas propias del adaptador.

Si un proveedor nuevo obliga a tocar un consumidor, el puerto está mal diseñado y se corrige aquí.

## Entregabilidad del outreach en frío

1. Nunca envíes desde tu dominio principal. Usa 2 o 3 dominios secundarios.
2. Configura SPF, DKIM y DMARC en cada dominio.
3. Calienta cada buzón 2 a 3 semanas antes del primer envío.
4. Mantén de 30 a 50 correos por buzón al día y suma buzones para crecer.
5. Correos cortos, en texto sencillo, con un solo enlace como máximo.
6. Pie legal con dirección física y forma de darse de baja en cada correo. Alisuite lo exige.
7. Verifica los correos antes de inscribir. Un rebote alto daña el dominio rápido.
