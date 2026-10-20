# Requisitos · Editor de outreach, MCP estable y boards grandes

## Contexto

Pedido del dueño del 20 de octubre de 2026, con Apollo ya funcionando en producción: dos secuencias creadas desde Alisuite y 25 inscritos el primer día.

1. El pie legal ya está en las plantillas de Apollo. Mandarlo desde Alisuite lo duplica.
2. Resend queda solo para el Worker, las funciones internas y el newsletter. La pantalla Secuencias sobra.
3. Claude no logra conectarse por MCP cuando la ventana Consultora está cerrada.
4. Claude falla con trabajos grandes en los boards, como grafos y diagramas de flujo.
5. En Outreach se quiere crear, ver, editar y eliminar secuencias sin entrar a Apollo.

## Evidencia reunida

| Tema | Hallazgo | Dónde |
| --- | --- | --- |
| Pie legal | `withFooter` lo añade a cada paso y `OutreachService.save` exige que exista | `providers/apollo/sequences.ts`, `outreach.service.ts` |
| Pie legal | Las plantillas reales de Apollo ya traen la dirección y la baja | detalle de la secuencia «Restaurantes con sitio web» |
| MCP | El servidor HTTP vive en el proceso principal, no en la ventana. Cerrar la ventana solo la oculta | `server.ts`, `consultora-window.ts` |
| MCP | En macOS, Cmd+Q con la ventana Consultora al frente cierra toda la app y con ella el servidor | menú por defecto de Electron, `window.ts` |
| MCP | Sin ventanas visibles, macOS puede aplicar App Nap y frenar la app. No hay `powerSaveBlocker` | `index.ts` |
| MCP | El cliente MCP no tiene timeout ni intenta abrir la app. Si falla, responde «no está abierto» | `src/mcp/client.ts` |
| MCP | El servicio de launchd que reabría la app se apagó al instalar la versión oficial | `scripts/install.sh` |
| Boards | `board_edit` admite 200 operaciones y una sola mala aborta todo el lote | `src/shared/canvas.ts` |
| Boards | Sin x e y, cada nodo nuevo va a la derecha del anterior: un diagrama queda en una fila | `applyBoardOps` |
| Boards | Cada edición devuelve el board completo con todos sus textos, y el contexto de Claude se llena rápido | `workspace.controller.ts` |
| Boards | Si el board está abierto en la app, una edición de Claude dispara el aviso de conflicto y no se recarga sola | `BoardPane.tsx` |
| Outreach | `GET /emailer_campaigns/{id}` sí devuelve pasos, toques y plantillas con asunto y HTML. El adaptador descarta el contenido | prueba real y `providers/apollo/sequences.ts` |
| Outreach | Editar hoy manda pasos sin id. Con el diff declarativo de Apollo eso borra y recrea los pasos y pierde su progreso | `apolloSequences.save` |
| Outreach | Apollo no permite borrar secuencias por API. Permite archivarlas con `POST /emailer_campaigns/{id}/archive`, que las desactiva y termina a los inscritos | docs.apollo.io |

## R1 · Pie legal opcional

- R1.1 El pie de outreach de Ajustes es opcional. Vacío no añade nada.
- R1.2 Crear secuencias e inscribir contactos ya no exige pie.
- R1.3 La ayuda del campo dice que se deje vacío si las plantillas de Apollo ya lo traen.
- R1.4 El estado de outreach y la pantalla ya no muestran el aviso de pie faltante.

## R2 · Resend solo para Worker, funciones internas y newsletter

- R2.1 Se eliminan la pantalla Secuencias, su entrada en la navegación, su IPC, sus rutas HTTP, sus herramientas MCP y `SequenceService`.
- R2.2 El newsletter, la sincronización de contactos y segments, los webhooks del Worker y los correos internos siguen igual.
- R2.3 El disparo de eventos hacia Resend y el nodo `start_sequence` se resuelven según la decisión D1.
- R2.4 La capa de proveedores no cambia de forma: Resend sigue declarando sus capacidades.

## R3 · MCP disponible aunque la ventana esté cerrada

- R3.1 Cerrar u ocultar la ventana Consultora nunca detiene el servidor local.
- R3.2 Cmd+Q en la ventana Consultora la oculta. Salir de verdad solo se hace desde la bandeja, y avisa que Claude perderá el acceso.
- R3.3 La app evita App Nap mientras el servidor local esté activo.
- R3.4 El cliente MCP usa un timeout por petición y un reintento corto.
- R3.5 Si la app no está corriendo, el cliente MCP la abre y espera hasta 20 segundos a que publique su conexión antes de rendirse.
- R3.6 El cliente detecta un `connection.json` viejo con un endpoint de salud y no lo confunde con la app abierta.
- R3.7 «Abrir al iniciar sesión» queda activo por defecto en la versión instalada.

## R4 · Boards grandes

- R4.1 `board_edit` valida todas las operaciones antes de aplicar y devuelve todos los errores juntos, con el índice de cada operación.
- R4.2 Un parámetro `layout` ordena automáticamente los nodos nuevos sin posición: `flow-down`, `flow-right`, `tree` y `grid`.
- R4.3 Un modo de diagrama recibe nodos y conexiones en una sola estructura y genera las operaciones.
- R4.4 La respuesta de `board_edit` es compacta por defecto: ids creados, conteos y errores. El board completo solo si se pide.
- R4.5 El límite sube a 500 operaciones por llamada, con escritura única al final.
- R4.6 Las conexiones eligen lados de salida y entrada según el layout, para que las flechas sigan el flujo.
- R4.7 Si el board está abierto en la app sin cambios pendientes, se recarga solo cuando Claude lo edita.
- R4.8 Un diagrama de 150 nodos y 200 conexiones se crea en una llamada en menos de 3 segundos.

## R5 · Editor de secuencias en Outreach

- R5.1 Botón «Nueva secuencia» con nombre y pasos: espera, asunto, cuerpo y modo de hilo.
- R5.2 Al abrir una secuencia se ve su contenido real: cada paso con asunto, espera y una vista previa segura del HTML.
- R5.3 Se puede editar el nombre y los pasos, y añadir, quitar o reordenar pasos.
- R5.4 Editar conserva los ids de pasos, toques y plantillas. Nunca recrea pasos que solo cambiaron de texto.
- R5.5 Si la secuencia está activa o tiene inscritos, se avisa antes de guardar que el cambio afecta a quien va a medio camino.
- R5.6 «Eliminar» archiva en Apollo, después de una confirmación que explica que termina a los inscritos. Desaparece de la lista.
- R5.7 Claude gana `get_outreach_sequence` y `archive_outreach_sequence`. Archivar exige `confirm: true`.
- R5.8 La vista previa del HTML no ejecuta scripts ni carga recursos activos.

## Decisiones abiertas

- D1 Con la pantalla Secuencias eliminada, los eventos `tag.<slug>` y `lead.created` hacia Resend y el nodo `start_sequence` ya no tienen uso. Recomendación: dejar de enviarlos y ocultar el nodo del catálogo. Si alguna automatización lo usa, se marca para revisión en vez de borrarse.
- D2 El cuerpo de los pasos se edita en un editor de texto enriquecido sencillo o en HTML con vista previa. Recomendación: texto enriquecido básico con negrita, enlaces y saltos de línea, que guarda HTML limpio.

## Fuera de alcance

1. Inscribir contactos desde la interfaz. Sigue por Claude.
2. Pruebas A/B de pasos.
3. Métricas por paso en la pantalla.
