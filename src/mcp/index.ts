/**
 * Servidor MCP (stdio) para Claude Desktop.
 * No toca la base de datos: traduce cada herramienta a la API local de la app,
 * así las reglas del día (techo de 8, validaciones) son las mismas que en la UI.
 */
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

const server = new McpServer(
  { name: 'daylios', version: '1.1.0' },
  {
    instructions:
      'DayliOS es el sistema operativo de Miguel: el día (máximo 8 tareas; subtareas sin límite con create_task + parent), ' +
      'notas relacionadas, clientes con proyectos y documentos, pipelines (uno por oferta), contactos con tags y email ' +
      'marketing (solo a suscritos). Las referencias a clientes, proyectos, prospectos, pipelines y etapas aceptan id o nombre. ' +
      'Las herramientas que borran piden confirm: true; llámalas primero sin él para ver el impacto y confirma con Miguel. ' +
      'El workspace es una carpeta real estilo Obsidian (notas .md, boards .canvas, imágenes): las notas del día y de voz ' +
      'van a «Notas rápidas»; organiza con workspace_*, y edita boards con board_read y board_edit.'
  }
)

for (const module of [tasks, notes, clients, meetings, pipeline, contacts, marketing, workspace])
  module.register(server)

void server.connect(new StdioServerTransport())
