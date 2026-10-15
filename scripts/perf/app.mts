import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { writeFixtures, type BoardSize } from './fixtures.mts'

export const REPO = resolve(import.meta.dirname, '../..')

export const built = (): boolean => existsSync(join(REPO, 'out/main/index.js'))

export function createHome(sizes: BoardSize[]): { home: string; workspace: string } {
  const home = mkdtempSync(join(tmpdir(), 'daylios-perf-'))
  const workspace = join(home, 'docs', 'Workspace')
  writeFixtures(workspace, sizes)
  writeFileSync(
    join(home, 'settings.json'),
    JSON.stringify({
      docsPath: join(home, 'docs'),
      voiceEnabled: false,
      voiceShortcut: '',
      workspaceShortcut: ''
    })
  )
  return { home, workspace }
}

export async function launch(home: string): Promise<{ app: ElectronApplication; win: Page }> {
  const electronPath = createRequire(import.meta.url)('electron') as string
  const app = await electron.launch({
    executablePath: electronPath,
    args: [
      join(REPO, 'out/main/index.js'),
      `--user-data-dir=${home}`,
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling'
    ],
    cwd: REPO,
    timeout: 60000
  })
  const menubar = await app.firstWindow()
  await menubar.waitForLoadState('domcontentloaded')
  const next = app.waitForEvent('window', { timeout: 20000 })
  await menubar.evaluate(() =>
    (window as unknown as { api: { openConsultora(): void } }).api.openConsultora()
  )
  const win = await next
  win.on('pageerror', (e) => process.stderr.write(`[página] ${e.message}\n`))
  win.on('console', (m) => {
    if (m.type() === 'error') process.stderr.write(`[consola] ${m.text().slice(0, 300)}\n`)
  })
  win.setDefaultTimeout(10000)
  await win.setViewportSize({ width: 1024, height: 800 })
  await win.waitForTimeout(2500)
  return { app, win }
}

export const count = (win: Page, selector: string): Promise<number> =>
  win.evaluate((s) => document.querySelectorAll(s).length, selector)

export const zoomOf = (win: Page): Promise<number | null> =>
  win.evaluate(() => {
    const v = document.querySelector('.react-flow__viewport')
    const m = v && getComputedStyle(v).transform.match(/matrix\(([^,]+),/)
    return m ? Math.round(Number(m[1]) * 1000) / 1000 : null
  })

export const memMb = (app: ElectronApplication): Promise<number> =>
  app.evaluate(({ app: electronApp }) =>
    Math.round(
      electronApp.getAppMetrics().reduce((sum, p) => sum + p.memory.workingSetSize, 0) / 1024
    )
  )

async function quickOpen(win: Page, name: string, attempt: number): Promise<boolean> {
  await win.keyboard.press('Escape')
  await win.keyboard.press('Meta+o')
  const shown = await win
    .waitForSelector('[role="dialog"]', { timeout: 3000 })
    .then(() => true)
    .catch(() => false)
  if (!shown) return false
  await win.waitForTimeout(500 * attempt)
  await win.keyboard.type(name)
  await win.waitForTimeout(600 * attempt)
  await win.keyboard.press('Enter')
  return true
}

async function fromExplorer(win: Page, name: string): Promise<boolean> {
  const item = win.getByText(name, { exact: true }).first()
  if (!(await item.isVisible().catch(() => false))) return false
  await item.click()
  return true
}

export async function openBoard(
  app: ElectronApplication,
  win: Page,
  name: string
): Promise<Record<string, unknown>> {
  const selector = `.react-flow__node[data-id^="${name}-"]`
  for (let attempt = 1; ; attempt++) {
    const t0 = Date.now()
    const asked = (await fromExplorer(win, name)) || (await quickOpen(win, name, attempt))
    const opened =
      asked &&
      (await win
        .waitForSelector(selector, { timeout: 30000 })
        .then(() => true)
        .catch(() => false))
    if (!opened) {
      if (attempt === 3) {
        mkdirSync(join(import.meta.dirname, 'results', 'shots'), { recursive: true })
        await win.screenshot({
          path: join(import.meta.dirname, 'results', 'shots', `fallo-${name}.png`)
        })
        throw new Error(`No se pudo abrir ${name}`)
      }
      await win.waitForTimeout(1000)
      continue
    }
    const firstNodeMs = Date.now() - t0
    await win.waitForTimeout(1500)
    return {
      firstNodeMs,
      attempts: attempt,
      dom: await count(win, '.react-flow__node'),
      edges: await count(win, '.react-flow__edge'),
      memMb: await memMb(app)
    }
  }
}
