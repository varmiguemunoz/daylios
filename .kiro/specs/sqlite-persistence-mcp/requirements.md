# Requisitos · Persistencia SQLite + servidor local + MCP

## Contexto

La UI de DayliOS está terminada y guarda en `localStorage` de forma provisional. Esta iteración conecta la persistencia real y abre la app a Claude Desktop.

## R1 · Persistencia SQLite

- R1.1 Las tareas viven en un único archivo SQLite en `~/Library/Application Support/daily-os/daylios.db`.
- R1.2 El esquema se crea y versiona solo al arrancar (sin pasos manuales).
- R1.3 La UI usa exclusivamente SQLite; se elimina el almacenamiento provisional y los datos demo.
- R1.4 Cada tarea guarda: id, título, día, hecha, posición, creada, completada, día de origen si fue arrastrada.

## R2 · Reglas del día (una sola fuente de verdad)

- R2.1 Máximo 8 tareas por día. La regla se aplica en el proceso principal, venga el cambio de la UI o de Claude.
- R2.2 Título obligatorio, sin espacios sobrantes, máximo 200 caracteres.
- R2.3 Fechas en formato `YYYY-MM-DD`; si no se indica, es hoy (hora local).
- R2.4 Mover una tarea a otro día la pone al final y recuerda su día de origen.
- R2.5 "Arrastrar pendientes" mueve las no completadas de un día a otro hasta llenar el hueco disponible y devuelve cuáles no cupieron.

## R3 · Servidor local

- R3.1 La app levanta un servidor HTTP pequeño solo en `127.0.0.1`, en un puerto libre.
- R3.2 Toda petición exige un token secreto. Puerto y token se escriben en `connection.json` (permisos 600) junto a la base de datos.
- R3.3 Expone: leer día, historial, crear, editar/completar, eliminar, mover y arrastrar pendientes.
- R3.4 Los errores devuelven JSON con un mensaje claro y el código HTTP adecuado.
- R3.5 Si Claude cambia algo, la ventana abierta se refresca sola.

## R4 · Servidor MCP para Claude Desktop

- R4.1 Proceso stdio independiente que Claude Desktop lanza desde su config.
- R4.2 Herramientas: `get_day`, `get_history`, `create_task`, `update_task`, `delete_task`, `move_task`, `carry_over_pending`.
- R4.3 `get_day` devuelve tareas + resumen (total, hechas, pendientes, huecos libres, techo) para que Claude decida si pedir más tareas.
- R4.4 Si la app no está abierta, la herramienta responde con un error comprensible.
- R4.5 Funciona con Node del sistema en desarrollo y con el binario de la app empaquetada.

## R5 · Calidad

- R5.1 Capas: dominio compartido → repositorio (SQL) → servicio (reglas) → adaptadores (IPC, HTTP, MCP).
- R5.2 Sin tests, sin logging, sin dependencias nativas nuevas (se usa `node:sqlite` incluido en Electron 39).
- R5.3 Eliminar lógica que ya no aporta (almacenamiento provisional, parámetros de previsualización, dependencias sin uso).
- R5.4 En la app empaquetada se abre al iniciar sesión, para que esté disponible a las 7:00.
