# Requisitos · Consultora (contexto de clientes para Claude)

## Contexto

Sistema local para que Claude tenga contexto real y actualizado de Ali Muñoz Advisory
(consultora de ingeniería e integración de software + AI). Vive **dentro de DayliOS**:
misma base SQLite, mismo servidor Express, mismo MCP. Se usa en una **ventana aparte** («Consultora»),
más grande que el popover del menubar.

Preguntas que Claude debe poder responder con una o dos llamadas MCP:

- ¿En qué está el proyecto X del cliente Y?
- ¿Qué se acordó en la última reunión con Y?
- ¿Qué entregables faltan en X? ¿Qué action items siguen abiertos?
- ¿Qué documentos tiene este cliente?
- ¿Cómo va el pipeline de ventas?

Solo lo usan el dueño y Claude. Sin multiusuario, sin integraciones con Zoom/Meet/Teams, email o facturación.

## M1 · Clientes

- M1.1 Lista de clientes con estado `activo` o `histórico`. Filtro por estado.
- M1.2 Campos: nombre, empresa/sector (opcional), contactos (markdown), notas de contexto (markdown), fecha de firma, carpeta de documentos.
- M1.3 Al crear un cliente se crea su carpeta `CLIENTS_DOCS_PATH/<Nombre>` con subcarpetas
  `Contratos/`, `Entregables/`, `Documentación técnica/`, `Reuniones/`. Si ya existe, se reutiliza.
- M1.4 `CLIENTS_DOCS_PATH` por defecto `~/Desktop/alimunozadvisory`; se cambia en el archivo de configuración.
- M1.5 Un cliente tiene 0..n proyectos y 0..n reuniones.
- M1.6 Renombrar un cliente no mueve su carpeta (se guarda la ruta; se puede cambiar a mano).

## M2 · Proyectos

- M2.1 Pertenece a un cliente. Estado: `activo`, `en pausa`, `cerrado`.
- M2.2 Campos markdown: descripción/objetivo, entregables/épicas (lista con casillas `- [ ]`), notas de contexto.
- M2.3 Muestra todas sus reuniones (más reciente primero).
- M2.4 Las casillas de entregables se pueden marcar desde la vista (y Claude puede actualizarlas).

## M3 · Documentos

- M3.1 No se guardan en la base: se leen en vivo de la carpeta del cliente (siempre exacto).
- M3.2 La UI lista archivos (nombre, carpeta, tamaño, fecha) y abre la carpeta o el archivo en Finder.
- M3.3 Claude puede listar documentos y leer el contenido de archivos de texto (`.md`, `.txt`, `.csv`, `.json`). PDF/DOCX: solo listado en el MVP.
- M3.4 Sincronizar con Google Drive queda fuera (manual, por el dueño).

## M4 · Reuniones

- M4.1 Grabar pantalla + micrófono + audio del sistema (voces de los demás). Inicio y fin manuales.
  Botón «Grabar» en la ventana Consultora y en el menú del menubar; indicador visible mientras graba.
- M4.2 Al detener: título, participantes y asociación (cliente / proyecto / prospecto).
  La asociación se propone sola si el título contiene el nombre de un cliente, proyecto o prospecto; el dueño confirma.
- M4.3 Procesado en segundo plano: extraer audio → transcribir (API OpenAI) → resumir (API OpenAI).
  Estados visibles: `grabando`, `transcribiendo`, `resumiendo`, `lista`, `error` (con «Reintentar»).
- M4.4 Resumen estructurado: resumen ejecutivo, decisiones tomadas, action items (quién · qué · para cuándo).
- M4.5 Campos: fecha, título, cliente/proyecto/prospecto, participantes, resumen ejecutivo, decisiones,
  action items, transcripción completa (markdown), notas crudas (markdown), ruta del archivo de grabación.
- M4.6 También se puede crear una reunión sin grabación (notas crudas a mano) y pedir el resumen sobre esas notas.
- M4.7 Action items se pueden marcar hechos (UI y Claude).
- M4.8 Todo resultado del modelo es editable a mano.

## M5 · Pipeline de prospectos

- M5.1 Lista de empresas/personas en venta. Campos: empresa, contacto (markdown), valor estimado (USD, opcional),
  origen (Upwork, referido, LinkedIn…), notas (markdown), próximo paso + fecha.
- M5.2 Etapas configurables (nombre, orden, tipo `abierta` | `ganada` | `perdida`).
  Por defecto: Contacto inicial, Discovery, Propuesta, Negociación, Ganado, Perdido.
- M5.3 Vista tablero por etapas (cambio de etapa con un selector, sin arrastrar en el MVP).
- M5.4 Pasar a una etapa `ganada` convierte el prospecto en cliente (si no lo está ya) y crea su carpeta. Una sola vez.
- M5.5 Las reuniones de venta se asocian al prospecto y siguen visibles tras convertirse en cliente.

## M6 · Claude (MCP)

- M6.1 Lectura pensada para responder en una llamada: panorama general, ficha completa de cliente, proyecto, pipeline, búsqueda.
- M6.2 Escritura completa: crear/editar clientes, proyectos, prospectos, reuniones (notas), action items; añadir notas fechadas.
- M6.3 Nombres aceptados en lugar de ids (coincidencia sin mayúsculas/acentos; si hay varias, devuelve candidatos).
- M6.4 Las respuestas son JSON compacto con markdown dentro, sin transcripciones salvo que se pidan.

## M7 · Configuración

- M7.1 Todo se configura desde la ventana (Ajustes), sin variables de entorno: API key de OpenAI, carpeta de clientes
  (selector de macOS), modelo de transcripción, modelo de resumen e idioma del resumen.
- M7.2 Se guarda en `~/Library/Application Support/daily-os/settings.json` (permisos 600). Aplica al momento, sin reiniciar.
- M7.3 La API key nunca vuelve al renderer: solo «guardada (…a1b2)». Botones Probar y Quitar.
- M7.4 Sin API key, todo funciona salvo transcripción y resumen (aviso claro con el camino a Ajustes).
- M7.5 Cambiar la carpeta raíz no mueve las carpetas de clientes existentes.

## Calidad

- Mismo patrón de DayliOS: TypeORM (sin SQL plano), MVC en Express, `transactionGuard` en escrituras, código simple.
- Sin tests (decisión del dueño). Migraciones que no tocan datos existentes.

## Fuera de alcance (MVP)

Integraciones Zoom/Meet/Teams, calendario, email, facturación, multiusuario, sincronización automática con Drive,
arrastrar tarjetas en el pipeline, identificar quién habla (diarización), lectura de PDF/DOCX por Claude,
convertir action items en tareas de Hoy (siguiente iteración natural).
