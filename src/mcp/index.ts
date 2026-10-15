import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as tasks from './tools/tasks'
import * as notes from './tools/notes'
import * as clients from './tools/clients'
import * as meetings from './tools/meetings'
import * as pipeline from './tools/pipeline'
import * as contacts from './tools/contacts'
import * as marketing from './tools/marketing'
import * as workspace from './tools/workspace'
import * as automations from './tools/automations'

const server = new McpServer(
  { name: 'daylios', version: '1.1.0' },
  {
    instructions:
      'Alisuite es el sistema operativo del equipo de Ali Muñoz Advisory: el día (máximo 8 tareas; subtareas sin límite con create_task + parent), ' +
      'notas relacionadas, clientes con proyectos y documentos, pipelines (uno por oferta), contactos con tags y email ' +
      'marketing (solo a suscritos). Las referencias a clientes, proyectos, prospectos, pipelines y etapas aceptan id o nombre. ' +
      'Las herramientas que borran piden confirm: true; llámalas primero sin él para ver el impacto y confirma con Miguel. ' +
      'El workspace es una carpeta real estilo Obsidian (notas .md, boards .canvas, imágenes): las notas del día y de voz ' +
      'van a «Notas rápidas»; organiza con workspace_*, y edita boards con board_read y board_edit. ' +
      'Las automatizaciones (estilo GoHighLevel) se arman con list_automation_catalog, save_automation_draft, ' +
      'test_automation y publish_automation.'
  }
)

for (const module of [
  tasks,
  notes,
  clients,
  meetings,
  pipeline,
  contacts,
  marketing,
  workspace,
  automations
])
  module.register(server)

void server.connect(new StdioServerTransport())
