# leads-hub

Worker de Cloudflare que recibe leads y webhooks de Resend aunque el Mac esté apagado.
Escribe directo en Resend (contacto, segments de sus tags, eventos que disparan secuencias) y deja
cada lead en una cola (D1) que DayliOS descarga cada minuto.

| Ruta                                                                                   | Quién la usa                    | Auth                                                       |
| -------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------- |
| `POST /in/<fuente>`                                                                    | Formularios, Zapier, Make       | Secreto de la fuente: `Authorization: Bearer …` o `?key=…` |
| `POST /resend/webhook`                                                                 | Resend (bajas, rebotes, quejas) | Firma svix (`RESEND_WEBHOOK_SECRET`)                       |
| `GET /admin/health` · `GET /admin/inbox` · `POST /admin/ack` · `GET/PUT /admin/config` | DayliOS                         | `Authorization: Bearer <ADMIN_TOKEN>`                      |

El Worker nunca guarda los secretos de las fuentes: DayliOS le envía su hash SHA-256.

## Desplegar

Requisitos: cuenta de Cloudflare y `npm install` hecho en la raíz del repo (el Worker usa el SDK
`resend` de allí) y en esta carpeta.

```sh
cd workers/leads-hub
npm install
npx wrangler login
npx wrangler d1 create leads-hub          # copia el database_id a wrangler.toml
npx wrangler d1 execute leads-hub --remote --file=schema.sql
openssl rand -hex 32                      # tu ADMIN_TOKEN (guárdalo: va también en DayliOS)
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put RESEND_API_KEY    # la misma key de Resend que en DayliOS
npm run deploy                            # imprime la URL https://leads-hub.<cuenta>.workers.dev
```

Después, en Resend → Webhooks, crea uno a `https://leads-hub.<cuenta>.workers.dev/resend/webhook`
con `contact.updated`, `email.bounced` y `email.complained`, y guarda su signing secret:

```sh
npx wrangler secret put RESEND_WEBHOOK_SECRET
```

En DayliOS: Ajustes → Hub de leads → URL y `ADMIN_TOKEN` → «Probar conexión». La app empuja
fuentes y reglas al Worker sola.

## Probar

```sh
curl -X POST 'https://leads-hub.<cuenta>.workers.dev/in/web' \
  -H 'Authorization: Bearer <secreto de la fuente>' \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@ejemplo.com","name":"Ana","tags":["webinar"]}'
```

Respuestas: `202` aceptado · `400` payload inválido · `401` secreto inválido · `404` fuente
desconocida · `413` más de 64 KB.

Los tests de la lógica (`src/hub.ts`) corren con `npm test` en la raíz. Comprobar el empaquetado
sin desplegar: `npm run build`.

Nota: la URL de una fuente no tiene límite de peticiones. Si la llamas desde el navegador (formulario
en tu web), el secreto queda visible: usa una fuente solo para la web y rota su secreto si ves abuso.
