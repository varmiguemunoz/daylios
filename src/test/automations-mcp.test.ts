import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const calls: { method: string; path: string; body?: object }[] = []

vi.mock('../mcp/client', async (original) => ({
  ...(await original<typeof import('../mcp/client')>()),
  api: async (method: string, path: string, body?: object) => {
    calls.push({ method, path, body })
    if (method === 'GET' && path.startsWith('/automations/runs')) return []
    return {
      automation: {
        id: 'a1',
        name: 'Bienvenida',
        status: 'active',
        versionNumber: 1,
        destructive: false
      },
      issues: [],
      hasDraftChanges: true
    }
  }
}))

type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }>

async function tools(): Promise<Map<string, Handler>> {
  const { register } = await import('../mcp/tools/automations')
  const found = new Map<string, Handler>()
  register({
    registerTool: (name: string, _config: unknown, handler: Handler) =>
      void found.set(name, handler)
  } as unknown as McpServer)
  return found
}

describe('herramientas MCP de automatizaciones', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('expone exactamente las de R12', async () => {
    expect([...(await tools()).keys()].sort()).toEqual(
      [
        'list_automation_catalog',
        'list_automations',
        'get_automation',
        'save_automation_draft',
        'publish_automation',
        'set_automation_status',
        'delete_automation',
        'test_automation',
        'run_automation',
        'list_automation_runs',
        'get_automation_run',
        'cancel_automation_run',
        'retry_automation_run'
      ].sort()
    )
  })

  it('publicar y borrar sin confirm solo muestran el impacto', async () => {
    const t = await tools()
    const preview = await t.get('publish_automation')!({ id: 'a1' })
    expect(JSON.parse(preview.content[0].text)).toMatchObject({ preview: true, name: 'Bienvenida' })
    await t.get('delete_automation')!({ id: 'a1' })
    expect(calls.every((c) => c.method === 'GET')).toBe(true)

    await t.get('publish_automation')!({ id: 'a1', confirm: true })
    await t.get('delete_automation')!({ id: 'a1', confirm: true })
    expect(calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /automations/a1/publish',
      'DELETE /automations/a1'
    ])
  })
})
