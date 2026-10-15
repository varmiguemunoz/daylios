import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { RUN_STATUSES, SUBJECT_TYPES } from '../../shared/automations/model'
import { api, enc, query, tool } from '../client'

const id = z.string().describe('Id de la automatización')
const runId = z.string().describe('Id de la ejecución')

interface Detail {
  automation: {
    id: string
    name: string
    status: string
    versionNumber: number | null
    destructive: boolean
  }
  issues: { message: string }[]
  hasDraftChanges: boolean
}

export function register(server: McpServer): void {
  server.registerTool(
    'list_automation_catalog',
    {
      description:
        'Catálogo de automatizaciones: forma de la definición, sujetos con sus variables, triggers, nodos con sus campos y ' +
        'salidas, campos para condiciones y operadores. Léelo antes de crear o editar una automatización.',
      inputSchema: {}
    },
    () => tool(() => api('GET', '/automations/catalog'))
  )

  server.registerTool(
    'list_automations',
    {
      description:
        'Automatizaciones con su frase («Cuando entra el tag X → …»), estado (draft, active, paused, locked), versión ' +
        'publicada, errores del borrador y conteos de ejecuciones.',
      inputSchema: {}
    },
    () => tool(() => api('GET', '/automations'))
  )

  server.registerTool(
    'get_automation',
    {
      description:
        'Una automatización con su borrador completo (definition), sus errores y si el borrador difiere de lo publicado.',
      inputSchema: { id }
    },
    ({ id }) => tool(() => api('GET', `/automations/${enc(id)}`))
  )

  server.registerTool(
    'save_automation_draft',
    {
      description:
        'Crea una automatización (sin id: pasa name y subject) o reemplaza el borrador de una existente. definition es la ' +
        'definición completa según list_automation_catalog; el sujeto no se puede cambiar. Devuelve los errores de ' +
        'validación. Guardar no cambia lo que corre: para eso, publish_automation.',
      inputSchema: {
        id: id.optional(),
        name: z.string().max(120).optional(),
        subject: z.enum(SUBJECT_TYPES).optional(),
        definition: z.record(z.string(), z.unknown()).optional()
      }
    },
    ({ id, name, subject, definition }) =>
      tool(async () => {
        let target = id
        if (!target) {
          if (!name || !subject)
            throw new Error('Para crear una automatización pasa name y subject.')
          target = ((await api('POST', '/automations', { name, subject })) as Detail).automation.id
        } else if (name) await api('PATCH', `/automations/${enc(target)}`, { name })
        if (definition) return api('PUT', `/automations/${enc(target)}/draft`, { definition })
        return api('GET', `/automations/${enc(target)}`)
      })
  )

  server.registerTool(
    'publish_automation',
    {
      description:
        'Publica el borrador como versión nueva y la deja activa. Las ejecuciones en curso siguen con su versión. Sin ' +
        'confirm devuelve qué se publicaría, sus errores y si borra registros; confirma con Miguel y llama con confirm: true.',
      inputSchema: { id, confirm: z.literal(true).optional() }
    },
    ({ id, confirm }) =>
      tool(async () => {
        if (!confirm) {
          const detail = (await api('GET', `/automations/${enc(id)}`)) as Detail
          return {
            preview: true,
            name: detail.automation.name,
            currentVersion: detail.automation.versionNumber,
            hasDraftChanges: detail.hasDraftChanges,
            issues: detail.issues.map((i) => i.message),
            note: 'No se publicó. Si Miguel lo aprueba, llama de nuevo con confirm: true.'
          }
        }
        return api('POST', `/automations/${enc(id)}/publish`, { acknowledgeDestructive: true })
      })
  )

  server.registerTool(
    'set_automation_status',
    {
      description:
        'Pausa o activa una automatización publicada. Activar también desbloquea una bloqueada por bucle.',
      inputSchema: { id, status: z.enum(['active', 'paused']) }
    },
    ({ id, status }) => tool(() => api('POST', `/automations/${enc(id)}/status`, { status }))
  )

  server.registerTool(
    'delete_automation',
    {
      description:
        'Borra una automatización: cancela sus ejecuciones abiertas y la manda a la papelera. Sin confirm devuelve el ' +
        'impacto y no borra.',
      inputSchema: { id, confirm: z.literal(true).optional() }
    },
    ({ id, confirm }) =>
      tool(async () => {
        if (!confirm) {
          const detail = (await api('GET', `/automations/${enc(id)}`)) as Detail
          const open = (
            (await api('GET', `/automations/runs${query({ automationId: id, limit: 200 })}`)) as {
              status: string
            }[]
          ).filter((r) => r.status === 'active' || r.status === 'waiting').length
          return {
            preview: true,
            name: detail.automation.name,
            status: detail.automation.status,
            openRunsToCancel: open,
            note: 'No se borró. Si Miguel lo aprueba, llama de nuevo con confirm: true.'
          }
        }
        return api('DELETE', `/automations/${enc(id)}`)
      })
  )

  server.registerTool(
    'test_automation',
    {
      description:
        'Simula el borrador sobre un sujeto real sin escribir nada: qué rama tomaría y qué haría cada paso, con las ' +
        'variables ya rellenadas. Las esperas se dan por cumplidas. subject_id es el id del contacto, prospecto, cliente, ' +
        'tarea o reunión según el sujeto; se omite si el sujeto es none.',
      inputSchema: { id, subject_id: z.string().optional() }
    },
    ({ id, subject_id }) =>
      tool(() => api('POST', `/automations/${enc(id)}/test`, { subjectId: subject_id ?? null }))
  )

  server.registerTool(
    'run_automation',
    {
      description:
        'Ejecuta ya la versión publicada sobre un sujeto, aunque no tenga el trigger «A mano». Debe estar activa. Ocurre de ' +
        'verdad: envía, crea y cambia lo que diga la automatización.',
      inputSchema: { id, subject_id: z.string().optional() }
    },
    ({ id, subject_id }) =>
      tool(() => api('POST', `/automations/${enc(id)}/run`, { subjectId: subject_id ?? null }))
  )

  server.registerTool(
    'list_automation_runs',
    {
      description:
        'Ejecuciones, las más recientes primero: sujeto, estado, paso actual, motivo y próxima ejecución. Filtra por ' +
        'automatización, sujeto o estado.',
      inputSchema: {
        automation_id: z.string().optional(),
        subject_id: z.string().optional(),
        status: z.enum(RUN_STATUSES).optional(),
        limit: z.number().int().min(1).max(200).optional()
      }
    },
    ({ automation_id, subject_id, status, limit }) =>
      tool(() =>
        api(
          'GET',
          `/automations/runs${query({ automationId: automation_id, subjectId: subject_id, status, limit })}`
        )
      )
  )

  server.registerTool(
    'get_automation_run',
    {
      description:
        'Una ejecución con todos sus pasos: estado, intento, mensaje y salida de cada uno.',
      inputSchema: { run_id: runId }
    },
    ({ run_id }) => tool(() => api('GET', `/automations/runs/${enc(run_id)}`))
  )

  server.registerTool(
    'cancel_automation_run',
    {
      description: 'Cancela una ejecución en curso o en espera.',
      inputSchema: { run_id: runId }
    },
    ({ run_id }) => tool(() => api('POST', `/automations/runs/${enc(run_id)}/cancel`))
  )

  server.registerTool(
    'retry_automation_run',
    {
      description:
        'Reintenta una ejecución fallida desde el paso que falló. Si está esperando, la reanuda ya saltando la espera.',
      inputSchema: { run_id: runId }
    },
    ({ run_id }) =>
      tool(async () => {
        const { run } = (await api('GET', `/automations/runs/${enc(run_id)}`)) as {
          run: { status: string }
        }
        const action = run.status === 'waiting' ? 'resume' : 'retry'
        return api('POST', `/automations/runs/${enc(run_id)}/${action}`)
      })
  )
}
