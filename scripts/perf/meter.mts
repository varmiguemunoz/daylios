import type { Page } from 'playwright-core'

export interface FrameStats {
  fps: number | null
  frames: number
  p50: number | null
  p95: number | null
  max: number | null
  over50ms: number
  longTaskMs: number
  longTasks: number
}

interface Meter {
  frames: number[]
  long: number
  longCount: number
  run: boolean
  obs?: PerformanceObserver
}

type MeterWindow = Window & { __meter: Meter }

export async function startMeter(page: Page): Promise<void> {
  await page.evaluate(() => {
    const m: Meter = { frames: [], long: 0, longCount: 0, run: true }
    ;(window as unknown as MeterWindow).__meter = m
    const tick = (t: number): void => {
      if (!m.run) return
      m.frames.push(t)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    m.obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        m.long += e.duration
        m.longCount++
      }
    })
    m.obs.observe({ entryTypes: ['longtask'] })
  })
}

export function stopMeter(page: Page): Promise<FrameStats> {
  return page.evaluate(() => {
    const m = (window as unknown as MeterWindow).__meter
    m.run = false
    m.obs?.disconnect()
    const f = m.frames
    const gaps = f
      .slice(1)
      .map((t, i) => t - f[i])
      .sort((a, b) => a - b)
    const span = f[f.length - 1] - f[0]
    const round = (v: number): number => Math.round(v * 10) / 10
    const pct = (p: number): number | null =>
      gaps.length ? round(gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))]) : null
    return {
      fps: span > 0 ? round(((f.length - 1) / span) * 1000) : null,
      frames: f.length,
      p50: pct(0.5),
      p95: pct(0.95),
      max: gaps.length ? Math.round(gaps[gaps.length - 1]) : null,
      over50ms: gaps.filter((g) => g > 50).length,
      longTaskMs: Math.round(m.long),
      longTasks: m.longCount
    }
  })
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

const center = (box: Box): [number, number] => [box.x + box.width / 2, box.y + box.height / 2]

export async function pan(page: Page, box: Box, steps = 60): Promise<void> {
  await page.mouse.move(...center(box))
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, i % 20 < 10 ? 60 : -60)
    await page.waitForTimeout(16)
  }
}

export async function zoom(page: Page, box: Box, steps = 40): Promise<void> {
  await page.mouse.move(...center(box))
  await page.keyboard.down('Meta')
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, i % 20 < 10 ? -40 : 40)
    await page.waitForTimeout(16)
  }
  await page.keyboard.up('Meta')
}

export async function drag(page: Page, x: number, y: number, steps = 60): Promise<void> {
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 0; i < steps; i++) {
    await page.mouse.move(x + (i % 30) * 6, y + (i % 30) * 3)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
}

export async function typeText(page: Page, text: string): Promise<void> {
  for (const ch of text) {
    await page.keyboard.type(ch)
    await page.waitForTimeout(16)
  }
}
