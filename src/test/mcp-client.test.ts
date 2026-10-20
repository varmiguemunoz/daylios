import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'http'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { AddressInfo } from 'net'

const dir = mkdtempSync(join(tmpdir(), 'alisuite-mcp-'))
const file = join(dir, 'connection.json')
process.env.DAYLIOS_CONNECTION = file

let client: typeof import('../mcp/client')
let server: Server
let port = 0

beforeAll(async () => {
  client = await import('../mcp/client')
  server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    if (req.url === '/health') {
      res.end(JSON.stringify({ ok: true }))
    } else if (req.headers.authorization !== 'Bearer t0k') {
      res.statusCode = 401
      res.end(JSON.stringify({ error: 'No autorizado.' }))
    } else {
      res.end(JSON.stringify({ path: req.url, method: req.method }))
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  port = (server.address() as AddressInfo).port
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

describe('cliente MCP', () => {
  it('sabe cómo abrir la app instalada y no intenta abrir otro binario', () => {
    expect(
      client.launchCommand('darwin', '/Applications/Alisuite.app/Contents/MacOS/Alisuite')
    ).toEqual({
      command: 'open',
      args: ['-b', 'com.alimunozadvisory.alisuite']
    })
    expect(
      client.launchCommand('win32', 'C:\\Program Files\\Alisuite\\Alisuite.exe')?.args
    ).toEqual([])
    expect(client.launchCommand('darwin', '/usr/local/bin/electron')).toBeNull()
  })

  it('llama a la app con su token y devuelve los errores del servidor', async () => {
    writeFileSync(file, JSON.stringify({ port, token: 't0k' }))
    expect(await client.api('GET', '/day')).toEqual({ path: '/day', method: 'GET' })
    writeFileSync(file, JSON.stringify({ port, token: 'malo' }))
    await expect(client.api('GET', '/day')).rejects.toThrow('No autorizado.')
  })

  it('con una conexión vieja y sin poder abrir la app avisa que no está abierta', async () => {
    writeFileSync(file, JSON.stringify({ port: 1, token: 't0k' }))
    await expect(client.api('GET', '/day')).rejects.toThrow(/no está abierto/)
  })
})
