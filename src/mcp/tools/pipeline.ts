import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { api, tool, day, query, ref, enc } from '../client'

const stage = z.object({
  id: z.string().optional().describe('id de una etapa existente (sin id = nueva)'),
  name: z.string().min(1).max(60),
  kind: z.enum(['open', 'won', 'lost']).describe('open = abierta, won = ganada (crea cliente), lost = perdida')
})

/** Herramientas MCP: pipelines y prospectos. */
export function register(server: McpServer): void {
  server.registerTool(
    'list_pipelines',
    {
      description: 'Pipelines (uno por oferta, p. ej.) con nº de etapas, prospectos y valor abierto.',
      inputSchema: {}
    },
    () => tool(() => api('GET', '/consultora/pipelines'))
  )

  server.registerTool(
    'get_pipeline',
    {
      description:
        'Un pipeline: etapas en orden con sus prospectos (valor, próximo paso, contacto principal, tags) y totales. ' +
        'Sin pipeline = el primero.',
      inputSchema: { pipeline: z.string().optional().describe('id o nombre del pipeline') }
    },
    ({ pipeline }) => tool(() => api('GET', `/consultora/pipeline${query({ pipeline })}`))
  )

  server.registerTool(
    'save_pipeline',
    {
      description:
        'Crea (sin pipeline) o edita un pipeline: nombre y, opcional, la lista COMPLETA de etapas en orden. ' +
        'Al crear sin etapas se ponen Lead, Contactado, Propuesta, Ganado y Perdido. Las etapas que falten se borran; ' +
        'si tienen prospectos, indica en moves a qué etapa pasan ({ from: id borrada, to: id que queda }). ' +
        'Debe haber al menos una etapa abierta.',
      inputSchema: {
        pipeline: z.string().optional().describe('id o nombre para editar'),
        name: z.string().min(1).max(60).optional(),
        stages: z.array(stage).min(1).optional(),
        moves: z.array(z.object({ from: z.string(), to: z.string() })).optional()
      }
    },
    ({ pipeline, ...body }) =>
      tool(() =>
        pipeline
          ? api('PATCH', `/consultora/pipelines/${enc(pipeline)}`, body)
          : api('POST', '/consultora/pipelines', body)
      )
  )

  server.registerTool(
    'delete_pipeline',
    {
      description:
        'Borra un pipeline (debe quedar al menos uno). Si tiene prospectos, move_to_pipeline (y opcional move_to_stage) ' +
        'dice a dónde van. Sin confirm devuelve el pipeline y no borra.',
      inputSchema: {
        pipeline: ref('del pipeline'),
        move_to_pipeline: z.string().optional(),
        move_to_stage: z.string().optional(),
        confirm: z.literal(true).optional()
      }
    },
    ({ pipeline, move_to_pipeline, move_to_stage, confirm }) =>
      tool(() =>
        api(
          'DELETE',
          `/consultora/pipelines/${enc(pipeline)}${query({
            confirm: confirm ? 1 : undefined,
            moveToPipeline: move_to_pipeline,
            moveToStage: move_to_stage
          })}`
        )
      )
  )

  server.registerTool(
    'get_prospect',
    {
      description: 'Un prospecto con su pipeline, etapa, notas, próximo paso, contactos y reuniones de venta.',
      inputSchema: { prospect: ref('del prospecto (empresa)') }
    },
    ({ prospect }) => tool(() => api('GET', `/consultora/prospects/${enc(prospect)}`))
  )

  server.registerTool(
    'save_prospect',
    {
      description:
        'Crea un prospecto (sin "prospect") o edita uno. Para cambiar de etapa usa move_prospect. ' +
        'valueUsd = valor estimado en USD. Al crear: pipeline (sin él, el primero) y stage (sin ella, la primera abierta).',
      inputSchema: {
        prospect: z.string().optional(),
        company: z.string().optional(),
        contactMd: z.string().optional(),
        valueUsd: z.number().min(0).optional(),
        source: z.string().optional(),
        notesMd: z.string().optional(),
        nextStep: z.string().optional(),
        nextStepDate: day.optional(),
        pipeline: z.string().optional().describe('Solo al crear: id o nombre del pipeline'),
        stage: z.string().optional().describe('Solo al crear: etapa inicial')
      }
    },
    ({ prospect, ...fields }) =>
      tool(() =>
        prospect
          ? api('PATCH', `/consultora/prospects/${enc(prospect)}`, fields)
          : api('POST', '/consultora/prospects', fields)
      )
  )

  server.registerTool(
    'move_prospect',
    {
      description:
        'Mueve un prospecto a otra etapa (también de otro pipeline: indica pipeline si el nombre de la etapa se repite). ' +
        'Una etapa de tipo ganado lo convierte en cliente (crea cliente y carpeta).',
      inputSchema: {
        prospect: ref('del prospecto'),
        stage: ref('de la etapa'),
        pipeline: z.string().optional().describe('id o nombre del pipeline de destino'),
        index: z.number().int().min(0).optional().describe('Posición dentro de la etapa (0 = arriba)')
      }
    },
    ({ prospect, stage: target, pipeline, index }) =>
      tool(() => api('POST', `/consultora/prospects/${enc(prospect)}/move`, { stage: target, pipeline, index }))
  )

  server.registerTool(
    'delete_prospect',
    {
      description: 'Borra un prospecto; sus contactos y reuniones quedan sin prospecto. Sin confirm no borra.',
      inputSchema: { prospect: ref('del prospecto'), confirm: z.literal(true).optional() }
    },
    ({ prospect, confirm }) =>
      tool(() => api('DELETE', `/consultora/prospects/${enc(prospect)}${query({ confirm: confirm ? 1 : undefined })}`))
  )
}
