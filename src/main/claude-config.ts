import { existsSync } from 'fs'
import { copyFile, mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { appDataRoot } from '@shared/app'

export const MCP_KEY = 'daylios'

export interface McpEntry {
  command: string
  args: string[]
  env: Record<string, string>
}

type ClaudeConfig = { mcpServers?: Record<string, unknown> } & Record<string, unknown>

export const claudeConfigPath = (
  platform: NodeJS.Platform,
  home: string,
  env: NodeJS.ProcessEnv
): string => join(appDataRoot(platform, home, env), 'Claude', 'claude_desktop_config.json')

export const mcpEntry = (executable: string, mcpScript: string): McpEntry => ({
  command: executable,
  args: [mcpScript],
  env: { ELECTRON_RUN_AS_NODE: '1' }
})

export function withMcp(config: ClaudeConfig, entry: McpEntry): ClaudeConfig {
  return { ...config, mcpServers: { ...(config.mcpServers ?? {}), [MCP_KEY]: entry } }
}

export function isLinked(config: ClaudeConfig, entry: McpEntry): boolean {
  const current = config.mcpServers?.[MCP_KEY] as McpEntry | undefined
  return Boolean(
    current && current.command === entry.command && current.args?.[0] === entry.args[0]
  )
}

async function readConfig(file: string): Promise<ClaudeConfig> {
  if (!existsSync(file)) return {}
  const raw = (await readFile(file, 'utf8')).trim()
  try {
    return raw ? (JSON.parse(raw) as ClaudeConfig) : {}
  } catch {
    throw new Error(`No pude leer ${file}: no es JSON válido. Corrígelo y vuelve a intentarlo.`)
  }
}

export async function claudeStatus(file: string, entry: McpEntry): Promise<boolean> {
  return isLinked(await readConfig(file).catch(() => ({})), entry)
}

export async function linkClaude(file: string, entry: McpEntry): Promise<void> {
  const config = await readConfig(file)
  await mkdir(dirname(file), { recursive: true })
  if (existsSync(file)) await copyFile(file, `${file}.bak`)
  await writeFile(file, JSON.stringify(withMcp(config, entry), null, 2) + '\n')
}
