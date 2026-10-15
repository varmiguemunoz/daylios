import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { dataDirFor } from '@shared/app'
import { keyLabel } from '@shared/keys'
import { protocolUrlIn } from '../main/protocol'
import { placeNearTray } from '../main/tray-placement'
import { claudeConfigPath, isLinked, linkClaude, mcpEntry, withMcp } from '../main/claude-config'
import { platformDefaults } from '../main/config'
import { fileInfo } from '../main/services/vault'

describe('atajos por plataforma', () => {
  it('macOS conserva los símbolos', () => {
    expect(keyLabel('Deshacer · ⌘Z', 'darwin')).toBe('Deshacer · ⌘Z')
  })

  it('Windows usa Ctrl, Alt, Shift y Enter', () => {
    expect(keyLabel('⇧⌘Z  ⌘Y', 'win32')).toBe('Shift+Ctrl+Z  Ctrl+Y')
    expect(keyLabel('⌘ ⇧ Espacio', 'win32')).toBe('Ctrl+Shift+Espacio')
    expect(keyLabel('⌥ Arrastrar', 'win32')).toBe('Alt+Arrastrar')
    expect(keyLabel('Suelta ⌥ para mover', 'win32')).toBe('Suelta Alt para mover')
    expect(keyLabel('⌘↵ ver todos', 'win32')).toBe('Ctrl+Enter ver todos')
    expect(keyLabel('Barra lateral (⌘\\)', 'win32')).toBe('Barra lateral (Ctrl+\\)')
  })
})

describe('carpeta de datos', () => {
  it('se llama daily-os en cada sistema', () => {
    expect(dataDirFor('darwin', '/Users/a', {})).toBe(
      join('/Users/a', 'Library', 'Application Support', 'daily-os')
    )
    expect(dataDirFor('win32', 'C:\\Users\\a', { APPDATA: 'R' })).toBe(join('R', 'daily-os'))
    expect(dataDirFor('linux', '/home/a', {})).toBe(join('/home/a', '.config', 'daily-os'))
  })

  it('Windows usa su Escritorio real y un atajo de voz libre', () => {
    expect(platformDefaults('win32', 'D')).toEqual({
      docsPath: join('D', 'alimunozadvisory'),
      voiceShortcut: 'CommandOrControl+Shift+Space'
    })
    expect(platformDefaults('darwin', 'D').voiceShortcut).toBe('Alt+Space')
  })
})

describe('enlace daylios:// en Windows', () => {
  it('lo encuentra en los argumentos de la segunda instancia', () => {
    const argv = ['C:\\Alisuite.exe', '--allow-file-access', 'daylios://auth/callback?code=1']
    expect(protocolUrlIn(argv)).toBe('daylios://auth/callback?code=1')
    expect(protocolUrlIn(['C:\\Alisuite.exe'])).toBeNull()
  })
})

describe('ventana compacta junto a la bandeja', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1040 }

  it('macOS: debajo del icono de la barra de menús', () => {
    const b = placeNearTray({ x: 1500, y: 0, width: 24, height: 24 }, area, 400, 760)
    expect(b).toEqual({ x: 1312, y: 30, width: 400, height: 760 })
  })

  it('Windows: encima de la barra de tareas y dentro de la pantalla', () => {
    const b = placeNearTray({ x: 1880, y: 1044, width: 24, height: 32 }, area, 400, 760)
    expect(b.x + b.width).toBeLessThanOrEqual(1912)
    expect(b.y + b.height).toBeLessThanOrEqual(1032)
    expect(b.y).toBeGreaterThanOrEqual(8)
    expect(b.height).toBe(760)
  })

  it('pantalla baja: encoge la ventana', () => {
    const low = { x: 0, y: 0, width: 1366, height: 728 }
    const b = placeNearTray({ x: 1300, y: 732, width: 24, height: 32 }, low, 400, 760)
    expect(b.y).toBe(8)
    expect(b.height).toBe(712)
  })
})

describe('Conectar con Claude', () => {
  const entry = mcpEntry('/Apps/Alisuite', '/Apps/app.asar/out/main/mcp.js')

  it('ruta de la configuración por sistema', () => {
    expect(claudeConfigPath('win32', 'C:\\Users\\a', { APPDATA: 'R' })).toBe(
      join('R', 'Claude', 'claude_desktop_config.json')
    )
  })

  it('conserva los demás servidores y es idempotente', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'alisuite-claude-'))
    const file = join(dir, 'Claude', 'claude_desktop_config.json')
    await linkClaude(file, entry)
    const other = { command: 'x', args: [] }
    const first = JSON.parse(readFileSync(file, 'utf8'))
    writeFileSync(
      file,
      JSON.stringify({ ...first, theme: 'dark', mcpServers: { ...first.mcpServers, other } })
    )
    await linkClaude(file, entry)
    await linkClaude(file, entry)
    const config = JSON.parse(readFileSync(file, 'utf8'))
    expect(config.theme).toBe('dark')
    expect(config.mcpServers.other).toEqual(other)
    expect(isLinked(config, entry)).toBe(true)
    expect(Object.keys(config.mcpServers)).toEqual(['daylios', 'other'])
  })

  it('no pisa un archivo que no es JSON', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'alisuite-claude-'))
    const file = join(dir, 'claude_desktop_config.json')
    writeFileSync(file, '{ roto')
    await expect(linkClaude(file, entry)).rejects.toThrow('no es JSON válido')
    expect(readFileSync(file, 'utf8')).toBe('{ roto')
    expect(withMcp({}, entry).mcpServers).toEqual({ daylios: entry })
  })
})

describe('inode en NTFS', () => {
  it('lee el inode como bigint sin perder precisión', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'alisuite-ino-'))
    const file = join(dir, 'a.md')
    writeFileSync(file, 'hola')
    const narrow = await fileInfo(file, false, false)
    const wide = await fileInfo(file, false, true)
    expect(wide?.inode).toBe(narrow?.inode)
    expect(wide?.size).toBe(4)
    expect(Math.abs((wide?.mtimeMs ?? 0) - (narrow?.mtimeMs ?? 0))).toBeLessThan(1)
  })
})
