# Requisitos · A3 Dashboard configurable

## Contexto

No hay un lugar para ver de un vistazo cómo va la operación. Los datos existen: tareas con fecha de
cierre, pipelines con etapas abiertas, ganadas y perdidas, valor por prospecto, reuniones y action
items. Falta guardar cuándo se gana o se pierde un negocio: hoy solo hay `updatedAt`.

## R1 · Sección Inicio

- R1.1 Nueva sección «Inicio», la primera de la barra lateral, con el dashboard.
- R1.2 Selector de periodo global: Esta semana, Este mes, Este trimestre, Este año o un rango. Cada
  indicador se compara con el periodo anterior.
- R1.3 Selector de pipeline: todos o uno.

## R2 · Componentes del catálogo, versión 1

Obligatorios por el pedido:

- R2.1 **Tareas abiertas y cerradas**: abiertas ahora, cerradas en el periodo y su tendencia.
- R2.2 **Tareas por estado**: Pendiente, En curso y Hecha, según A2.
- R2.3 **Valor del pipeline abierto**: suma del valor de los prospectos en etapas abiertas.
- R2.4 **Negocios ganados**: cantidad y valor en el periodo.
- R2.5 **Negocios perdidos**: cantidad y valor en el periodo.
- R2.6 **Valor por etapa**: barras por etapa del pipeline elegido.

Adicionales del catálogo:

- R2.7 Tasa de cierre: ganados sobre ganados más perdidos.
- R2.8 Tareas atrasadas y próximos pasos vencidos, como listas que abren el elemento.
- R2.9 Reuniones de la semana y action items abiertos.
- R2.10 Contactos nuevos y suscritos del email marketing.

## R3 · Configurable

- R3.1 Modo edición con «Editar dashboard»: añadir desde el catálogo, quitar, reordenar arrastrando
  y elegir tamaño: un cuarto, medio o todo el ancho, y alto de una o dos filas.
- R3.2 Cada componente puede tener ajustes propios: periodo propio, pipeline, tag o estado.
- R3.3 Hay un diseño inicial con los seis obligatorios. «Restablecer» vuelve a él.
- R3.4 El diseño se guarda como dato del usuario, no como estado de ventana. Con la nube, según N3,
  viaja con la cuenta.
- R3.5 Varios dashboards con nombre queda preparado en los datos pero fuera de la versión 1.

## R4 · Comportamiento

- R4.1 Clic en un indicador abre su origen filtrado: tareas atrasadas abre Tareas con ese filtro;
  ganados abre el Pipeline en Lista con la etapa ganada.
- R4.2 Se actualiza solo cuando cambian los datos, sin recargar la pantalla.
- R4.3 Cada componente tiene sus estados de carga, vacío y error, sin romper a los demás.
- R4.4 Accesible: cada gráfico tiene un resumen en texto y una tabla equivalente a un clic.

## R5 · Claude

- R5.1 Herramienta MCP `get_metrics` con periodo y pipeline, que devuelve los mismos números.

## R6 · Datos nuevos

- R6.1 Se registra cada cambio de etapa de un prospecto con fecha. Ganado y perdido en el periodo se
  calculan con ese registro.
- R6.2 Los prospectos que ya están ganados o perdidos usan su `updatedAt` como fecha de cierre
  inicial.
