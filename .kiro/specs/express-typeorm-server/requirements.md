# Requisitos · Servidor Express + TypeORM (refactor)

## Contexto
La primera iteración (`sqlite-persistence-mcp`) conectó SQLite y el MCP, pero el servidor usaba SQL escrito a mano,
un servidor HTTP con rutas por expresiones regulares y transacciones manuales. Esta iteración lo reemplaza por
un backend estándar, fácil de leer y de intervenir.

## R1 · Persistencia con ORM
- R1.1 Toda consulta pasa por TypeORM (repositorio / find options). Cero SQL plano en el código.
- R1.2 Se mantiene SQLite en `~/Library/Application Support/daily-os/daylios.db` (driver `better-sqlite3`).
- R1.3 El esquema se crea con migraciones de TypeORM al arrancar. Una base creada por la versión anterior se conserva tal cual.
- R1.4 El modelo usa el tipo `Task` compartido (sin duplicar la forma de la tarea).

## R2 · Guard de transacciones
- R2.1 Toda escritura (crear, editar, borrar, restaurar, mover, arrastrar) corre dentro de una transacción.
- R2.2 Si algo falla dentro de la transacción, se revierte completa y el error llega al cliente.
- R2.3 Las transacciones se ejecutan de una en una (SQLite = una conexión), aunque lleguen a la vez de la UI y de Claude.

## R3 · API en Express con MVC
- R3.1 Servidor Express 5, solo en `127.0.0.1`, puerto libre, token Bearer obligatorio.
- R3.2 Capas: Modelo (`models/`) · Vista JSON (`views/`) · Controlador (`controllers/`) · Rutas (`routes/`) · Servicio con reglas (`services/`).
- R3.3 Mismas rutas y respuestas que antes (el MCP no cambia).
- R3.4 Errores en JSON con el código correcto: 400 inválido, 401 token, 404 no existe, 409 día lleno, 413 cuerpo grande, 500 interno.
- R3.5 Tras cada escritura exitosa por HTTP, la ventana se refresca.

## R4 · Simplicidad
- R4.1 Cada archivo hace una cosa y se entiende leyéndolo de arriba abajo.
- R4.2 Sin abstracciones genéricas "inteligentes" (bucles con `apply`, fábricas de funciones) donde una lista explícita se lee mejor.
- R4.3 Sin efectos de React que re-rendericen de más o se re-registren en cada render.

## R5 · Fuera de alcance
- Tests, logging, cambios de UI/diseño, cambios en las herramientas MCP.
