import type { ElectronApplication, Page } from 'playwright-core'
import { built, count, createHome, launch, memMb, openBoard, zoomOf } from './app.mts'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { SIZES, type BoardSize } from './fixtures.mts'
import {
  drag,
  pan,
  startMeter,
  stopMeter,
  typeText,
  zoom,
  type Box,
  type FrameStats
} from './meter.mts'

const HERE = import.meta.dirname
const BASELINE = join(HERE, 'baseline.json')
const TOLERANCE_MS = 16.7

type Result = Record<string, unknown>
type Run = Record<string, Result>

const { values: args } = parseArgs({
  options: {
    runs: { type: 'string', default: '3' },
    sizes: { type: 'string', default: SIZES.map((s) => s.name).join(',') },
    'write-baseline': { type: 'boolean', default: false }
  }
})

const sizes: BoardSize[] = SIZES.filter((s) => args.sizes.split(',').includes(s.name))

const visibleCard = (win: Page): Promise<{ x: number; y: number } | null> =>
  win.evaluate(() => {
    const flow = document.querySelector('.react-flow')!.getBoundingClientRect()
    const cx = flow.left + flow.width / 2
    const cy = flow.top + flow.height / 2
    const grab = (r: DOMRect): { x: number; y: number } => ({
      x: r.left + Math.min(30, r.width / 2),
      y: r.top + Math.min(30, r.height / 2)
    })
    const usable = [...document.querySelectorAll('.react-flow__node')]
      .map((n) => n.getBoundingClientRect())
      .filter((r) => {
        const p = grab(r)
        return (
          r.width > 4 &&
          p.x > flow.left + 60 &&
          p.y > flow.top + 60 &&
          p.x < flow.right - 260 &&
          p.y < flow.bottom - 160
        )
      })
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))
    return usable.length ? grab(usable[0]) : null
  })

async function measure(win: Page, action: () => Promise<void>): Promise<FrameStats> {
  await startMeter(win)
  await action()
  return stopMeter(win)
}

async function saveMs(win: Page, file: string): Promise<number | null> {
  const p = await visibleCard(win)
  if (!p) return null
  const before = statSync(file).mtimeMs
  await win.mouse.move(p.x, p.y)
  await win.mouse.down()
  await win.mouse.move(p.x + 40, p.y + 20, { steps: 5 })
  await win.mouse.up()
  const t0 = Date.now()
  while (Date.now() - t0 < 15000) {
    if (statSync(file).mtimeMs !== before) return Date.now() - t0
    await win.waitForTimeout(20)
  }
  return null
}

async function boardScenarios(
  app: ElectronApplication,
  win: Page,
  size: BoardSize,
  workspace: string
): Promise<Result> {
  const out: Result = {}
  out.open = await openBoard(app, win, size.name)
  const box: Box = (await win.locator('.react-flow').boundingBox())!
  await win.mouse.click(box.x + 5, box.y + box.height - 5)
  await win.keyboard.press('Shift+Digit1')
  await win.waitForTimeout(800)
  out.fit = {
    zoom: await zoomOf(win),
    dom: await count(win, '.react-flow__node'),
    edges: await count(win, '.react-flow__edge')
  }
  out.panFit = await measure(win, () => pan(win, box))
  out.zoomFit = await measure(win, () => zoom(win, box))
  await win.keyboard.press('Shift+Digit1')
  await win.waitForTimeout(800)
  const fitCard = await visibleCard(win)
  if (fitCard) {
    await win.mouse.click(fitCard.x, fitCard.y)
    out.dragFit = await measure(win, () => drag(win, fitCard.x, fitCard.y))
    await win.keyboard.press('Meta+z')
    await win.keyboard.press('Meta+a')
    out.dragAllFit = await measure(win, () => drag(win, fitCard.x, fitCard.y))
    await win.keyboard.press('Meta+z')
    await win.mouse.click(box.x + 5, box.y + box.height - 5)
  }
  await win.keyboard.press('Meta+0')
  await win.waitForTimeout(800)
  out.at100 = {
    zoom: await zoomOf(win),
    dom: await count(win, '.react-flow__node'),
    memMb: await memMb(app)
  }
  out.pan100 = await measure(win, () => pan(win, box))
  const card = await visibleCard(win)
  if (card) {
    await win.mouse.click(card.x, card.y)
    out.drag100 = await measure(win, () => drag(win, card.x, card.y))
    await win.keyboard.press('Meta+z')
    await win.waitForTimeout(300)
    const target = await visibleCard(win)
    if (target) {
      await win.mouse.dblclick(target.x, target.y)
      await win.waitForTimeout(300)
      out.type100 = await measure(win, () => typeText(win, ' texto escrito para medir la edicion'))
      await win.keyboard.press('Escape')
      await win.keyboard.press('Meta+z')
    }
  }
  await win.waitForTimeout(1200)
  out.saveMs = await saveMs(win, join(workspace, `${size.name}.canvas`))
  return out
}

async function oneRun(): Promise<Run> {
  const { home, workspace } = createHome(sizes)
  const { app, win } = await launch(home)
  const run: Run = {}
  try {
    for (const size of sizes) {
      try {
        run[size.name] = await boardScenarios(app, win, size, workspace)
      } catch (e) {
        run[size.name] = { error: String((e as Error).message ?? e).slice(0, 300) }
      }
      process.stdout.write(`  ${size.name} ok\n`)
    }
  } finally {
    await Promise.race([app.close(), new Promise((r) => setTimeout(r, 5000))])
    rmSync(home, { recursive: true, force: true })
  }
  return run
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10
}

function summarize(runs: Run[]): Run {
  const out: Run = {}
  for (const board of Object.keys(runs[0] ?? {})) {
    out[board] = {}
    for (const scenario of Object.keys(runs.find((r) => !r[board]?.error)?.[board] ?? {})) {
      const samples = runs.filter((r) => !r[board]?.error).map((r) => r[board]?.[scenario])
      const first = samples[0]
      if (typeof first === 'number')
        out[board][scenario] = median(samples.filter((s): s is number => typeof s === 'number'))
      else if (first && typeof first === 'object') {
        const merged: Record<string, number | null> = {}
        for (const key of Object.keys(first)) {
          const vals = samples
            .map((s) => (s as Record<string, unknown> | undefined)?.[key])
            .filter((v): v is number => typeof v === 'number')
          merged[key] = vals.length ? median(vals) : null
        }
        out[board][scenario] = merged
      } else out[board][scenario] = first ?? null
    }
  }
  return out
}

function compare(now: Run, base: Run): string[] {
  const issues: string[] = []
  for (const [board, scenarios] of Object.entries(now)) {
    for (const [scenario, value] of Object.entries(scenarios)) {
      const before = base[board]?.[scenario] as { p95?: number } | undefined
      const p95 = (value as { p95?: number } | null)?.p95
      if (typeof p95 !== 'number' || typeof before?.p95 !== 'number') continue
      if (p95 > before.p95 + TOLERANCE_MS)
        issues.push(`${board}.${scenario}: p95 ${before.p95} a ${p95} ms`)
    }
  }
  return issues
}

async function main(): Promise<void> {
  if (!built()) {
    console.error('Falta out/. Ejecuta antes: npx electron-vite build')
    process.exit(2)
  }
  const runs: Run[] = []
  for (let i = 0; i < Number(args.runs); i++) {
    process.stdout.write(`ejecución ${i + 1}\n`)
    runs.push(await oneRun())
  }
  const summary = summarize(runs)
  const failed = Object.fromEntries(
    sizes.map((s) => [s.name, runs.filter((r) => r[s.name]?.error).length])
  )
  const report = {
    at: new Date().toISOString(),
    window: '1024x800',
    runs: runs.length,
    failed,
    summary,
    samples: runs
  }
  mkdirSync(join(HERE, 'results'), { recursive: true })
  const file = join(HERE, 'results', `${report.at.replace(/[:.]/g, '-')}.json`)
  writeFileSync(file, JSON.stringify(report, null, 2))
  process.stdout.write(`resultado: ${file}\n`)
  const broken = Object.entries(failed).filter(([, n]) => n > 0)
  if (broken.length) {
    process.stdout.write(`ejecuciones fallidas: ${JSON.stringify(Object.fromEntries(broken))}\n`)
    process.exitCode = 1
    return
  }
  if (args['write-baseline']) {
    writeFileSync(
      BASELINE,
      JSON.stringify(
        { at: report.at, window: report.window, runs: report.runs, failed, summary },
        null,
        2
      )
    )
    process.stdout.write('línea base actualizada\n')
    return
  }
  if (!existsSync(BASELINE)) return
  const issues = compare(summary, JSON.parse(readFileSync(BASELINE, 'utf8')).summary)
  process.stdout.write(issues.length ? `regresiones:\n${issues.join('\n')}\n` : 'sin regresiones\n')
  if (issues.length) process.exitCode = 1
}

await main()
