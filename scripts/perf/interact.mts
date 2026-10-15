import type { Page } from 'playwright-core'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { built, createHome, launch, openBoard, zoomOf } from './app.mts'

const HERE = import.meta.dirname
const PREFIX = 'interact-'
const SAVE_WAIT = 900
const CARD = 260

interface Saved {
  nodes: { id: string; x: number; y: number; width: number; height: number }[]
  edges: unknown[]
}

interface Check {
  name: string
  ok: boolean
  detail: unknown
}

interface Point {
  x: number
  y: number
}

const SHOTS = join(HERE, 'results', 'shots')
const shot = (win: Page, name: string): Promise<Buffer> =>
  win.screenshot({ path: join(SHOTS, `${name}.png`) })

const checks: Check[] = []
const record = (name: string, ok: boolean, detail: unknown): void => {
  checks.push({ name, ok, detail })
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${name} ${JSON.stringify(detail)}\n`)
}

const near = (a: number, b: number, tolerance = 1.5): boolean => Math.abs(a - b) <= tolerance

function reader(file: string): {
  all: () => Saved
  get: (id: string) => Saved['nodes'][number]
} {
  const all = (): Saved => JSON.parse(readFileSync(file, 'utf8')) as Saved
  return {
    all,
    get: (id) => {
      const n = all().nodes.find((x) => x.id === PREFIX + id)
      if (!n) throw new Error(`no existe ${id}`)
      return n
    }
  }
}

const selector = (id: string): string => `.react-flow__node[data-id="${PREFIX}${id}"]`

async function grab(win: Page, id: string): Promise<Point> {
  const b = (await win.locator(selector(id)).boundingBox())!
  return { x: b.x + Math.min(30, b.width / 2), y: b.y + Math.min(30, b.height / 2) }
}

async function clickNode(win: Page, id: string, shift = false): Promise<void> {
  const p = await grab(win, id)
  if (shift) await win.keyboard.down('Shift')
  await win.mouse.click(p.x, p.y)
  if (shift) await win.keyboard.up('Shift')
}

async function dragBy(
  win: Page,
  id: string,
  units: Point,
  key?: string,
  probe?: () => Promise<unknown>
): Promise<unknown> {
  await win.keyboard.press('Escape')
  const zoom = (await zoomOf(win)) ?? 1
  const p = await grab(win, id)
  await win.mouse.move(p.x, p.y)
  await win.mouse.down()
  if (key) await win.keyboard.down(key)
  await win.mouse.move(p.x + 3, p.y + 3, { steps: 2 })
  await win.mouse.move(p.x + units.x * zoom, p.y + units.y * zoom, { steps: 14 })
  const seen = probe ? await probe() : null
  await win.mouse.up()
  if (key) await win.keyboard.up(key)
  await win.waitForTimeout(SAVE_WAIT)
  return seen
}

async function toFlow(win: Page, p: Point): Promise<Point> {
  return win.evaluate((screen) => {
    const box = document.querySelector('.react-flow')!.getBoundingClientRect()
    const m = getComputedStyle(document.querySelector('.react-flow__viewport')!).transform.match(
      /matrix\(([^,]+),[^,]+,[^,]+,[^,]+,([^,]+),([^)]+)\)/
    )!
    const [s, tx, ty] = [Number(m[1]), Number(m[2]), Number(m[3])]
    return { x: (screen.x - box.left - tx) / s, y: (screen.y - box.top - ty) / s }
  }, p)
}

async function emptySpot(win: Page): Promise<Point> {
  const box = (await win.locator('.react-flow').boundingBox())!
  return { x: box.x + 60, y: box.y + box.height - 60 }
}

async function strokeOnScreen(win: Page): Promise<{ display: number; hit: number } | null> {
  const zoom = (await zoomOf(win)) ?? 1
  const px = await win.evaluate(() => {
    const path = document.querySelector('.react-flow__edge-path')
    const hit = document.querySelector('.react-flow__edge-interaction')
    if (!path || !hit) return null
    return {
      display: parseFloat(getComputedStyle(path).strokeWidth),
      hit: parseFloat(getComputedStyle(hit).strokeWidth)
    }
  })
  return px
    ? {
        display: Math.round(px.display * zoom * 100) / 100,
        hit: Math.round(px.hit * zoom * 100) / 100
      }
    : null
}

async function menuLabels(win: Page): Promise<string[]> {
  return win.locator('[role="menu"] button').allInnerTexts()
}

async function run(win: Page, file: string): Promise<void> {
  const board = reader(file)
  const box = (await win.locator('.react-flow').boundingBox())!
  await win.mouse.click(box.x + 5, box.y + box.height - 5)
  await win.keyboard.press('Shift+Digit1')
  await win.waitForTimeout(600)

  {
    const before = board.get('c5')
    await dragBy(win, 'c5', { x: 33, y: 0 })
    const after = board.get('c5')
    record('rejilla redondea a 20', after.x - before.x === 40 && after.y === before.y, {
      dx: after.x - before.x,
      dy: after.y - before.y
    })
  }

  {
    const before = board.get('c5')
    await dragBy(win, 'c5', { x: 33, y: 7 }, 'Control')
    const after = board.get('c5')
    const dx = after.x - before.x
    const dy = after.y - before.y
    record('⌃ desactiva rejilla y objetos', (dx % 20 !== 0 || dy % 20 !== 0) && dy > 0, {
      dx,
      dy
    })
  }

  {
    const before = board.get('c2')
    const target = board.get('c6')
    const guides = await dragBy(
      win,
      'c2',
      { x: target.x - 8 - before.x, y: 0 },
      undefined,
      async () => {
        await shot(win, 'guias')
        return win.locator('.ob-guide').count()
      }
    )
    const after = board.get('c2')
    record('ajuste a objetos con guía', after.x === target.x && Number(guides) > 0, {
      x: after.x,
      esperado: target.x,
      guias: guides
    })
  }

  {
    const before = board.get('c4')
    await dragBy(win, 'c4', { x: 100, y: 37 }, 'Shift')
    const after = board.get('c4')
    record('⇧ fija el eje', after.y === before.y && after.x - before.x === 100, {
      dx: after.x - before.x,
      dy: after.y - before.y
    })
  }

  {
    const before = board.all()
    const origin = board.get('c3')
    await dragBy(win, 'c3', { x: 0, y: 200 }, 'Alt')
    await win.waitForTimeout(300)
    const after = board.all()
    const stays = board.get('c3')
    const known = new Set(before.nodes.map((n) => n.id))
    const clone = after.nodes.find((n) => !known.has(n.id))
    record(
      '⌥ clona y deja el original',
      after.nodes.length === before.nodes.length + 1 &&
        stays.x === origin.x &&
        stays.y === origin.y &&
        clone?.x === origin.x &&
        clone?.y === origin.y + 200,
      { original: [stays.x, stays.y], copia: clone ? [clone.x, clone.y] : null }
    )
  }

  {
    await win.keyboard.press('Escape')
    await clickNode(win, 'c0')
    const before = board.get('c0')
    await win.keyboard.press('ArrowRight')
    await win.waitForTimeout(SAVE_WAIT)
    const mid = board.get('c0')
    await win.keyboard.press('Shift+ArrowDown')
    await win.waitForTimeout(SAVE_WAIT)
    const after = board.get('c0')
    record('flechas mueven 20 y 100', mid.x - before.x === 20 && after.y - mid.y === 100, {
      dx: mid.x - before.x,
      dy: after.y - mid.y
    })
  }

  {
    await win.keyboard.press('Escape')
    await clickNode(win, 'c0')
    await clickNode(win, 'c4', true)
    await win.locator('[aria-label="Alinear"]').click()
    await shot(win, 'menu-alinear')
    await win.locator('[role="menu"] button', { hasText: 'Alinear a la izquierda' }).click()
    await win.waitForTimeout(SAVE_WAIT)
    const a = board.get('c0')
    const b = board.get('c4')
    record('alinear a la izquierda', a.x === b.x, { c0: a.x, c4: b.x })
  }

  {
    await win.keyboard.press('Escape')
    await clickNode(win, 'c0')
    await clickNode(win, 'c1', true)
    await clickNode(win, 'c2', true)
    await win.locator('[aria-label="Alinear"]').click()
    await win.locator('[role="menu"] button', { hasText: 'Distribuir en horizontal' }).click()
    await win.waitForTimeout(SAVE_WAIT)
    const [a, b, c] = ['c0', 'c1', 'c2'].map((id) => board.get(id)).sort((p, q) => p.x - q.x)
    const left = b.x - (a.x + CARD)
    const right = c.x - (b.x + CARD)
    record('distribuir con huecos iguales', near(left, right, 1), { left, right })
  }

  {
    await win.keyboard.press('Escape')
    await clickNode(win, 'c1')
    await win.keyboard.press('Meta+c')
    const spot = await emptySpot(win)
    await win.mouse.move(spot.x, spot.y)
    const before = board.all()
    await win.keyboard.press('Meta+v')
    await win.waitForTimeout(SAVE_WAIT)
    const known = new Set(before.nodes.map((n) => n.id))
    const pasted = board.all().nodes.find((n) => !known.has(n.id))
    const raw = await toFlow(win, spot)
    const at = { x: Math.round(raw.x / 20) * 20, y: Math.round(raw.y / 20) * 20 }
    const ok =
      Boolean(pasted) &&
      near(pasted!.x + pasted!.width / 2, at.x, 1) &&
      near(pasted!.y + pasted!.height / 2, at.y, 1)
    record('pegar en el puntero, ajustado a la rejilla', ok, {
      centro: pasted ? [pasted.x + pasted.width / 2, pasted.y + pasted.height / 2] : null,
      puntero: [Math.round(at.x), Math.round(at.y)]
    })
  }

  {
    await win.keyboard.press('Shift+Digit1')
    await win.waitForTimeout(600)
    await shot(win, 'encuadre')
    const fit = await strokeOnScreen(win)
    await clickNode(win, 'c0')
    await win.keyboard.press('Shift+Digit2')
    await win.waitForTimeout(600)
    await shot(win, 'zoom-maximo')
    const max = await zoomOf(win)
    const close = await strokeOnScreen(win)
    record('zoom a selección no pasa de 2', max !== null && max <= 2, { zoom: max })
    record(
      'conexión de 2 px y zona de 24 px en pantalla',
      Boolean(fit && close) &&
        near(fit!.display, 2, 0.3) &&
        near(close!.display, 2, 0.3) &&
        near(close!.hit, 24, 1),
      { fit, cerca: close }
    )
  }

  {
    for (let i = 0; i < 25; i++) {
      await win.keyboard.press('Meta+Minus')
      await win.waitForTimeout(200)
    }
    await win.waitForTimeout(500)
    const min = await zoomOf(win)
    record('zoom mínimo 0.0625', min !== null && near(min, 0.0625, 0.001), { zoom: min })
  }

  {
    await win.keyboard.press('Shift+Digit1')
    await win.waitForTimeout(600)
    const spot = await emptySpot(win)
    await win.mouse.click(spot.x, spot.y, { button: 'right' })
    const labels = await menuLabels(win)
    await shot(win, 'menu-fondo')
    const expected = [
      'Añadir tarjeta',
      'Añadir nota de la bóveda',
      'Añadir imagen o archivo',
      'Añadir página web',
      'Crear grupo',
      'Ajustar a la rejilla',
      'Ajustar a objetos',
      'Solo lectura',
      'Encuadrar todo'
    ]
    record(
      'menú del fondo',
      expected.every((l) => labels.includes(l)),
      { faltan: expected.filter((l) => !labels.includes(l)) }
    )
    await win.locator('[role="menu"] button', { hasText: 'Solo lectura' }).click()
    await clickNode(win, 'c1')
    const before = board.get('c1')
    await win.keyboard.press('ArrowRight')
    await win.waitForTimeout(SAVE_WAIT)
    const after = board.get('c1')
    const badge = await win.locator('.ob-toolbar', { hasText: 'Solo lectura' }).count()
    record('solo lectura bloquea cambios', after.x === before.x && badge === 1, {
      dx: after.x - before.x,
      aviso: badge
    })
    await win.locator('.ob-toolbar', { hasText: 'Solo lectura' }).click()
  }

  {
    const target = await grab(win, 'c1')
    await win.mouse.click(target.x, target.y, { button: 'right' })
    const labels = await menuLabels(win)
    const expected = ['Encuadrar selección', 'Editar', 'Convertir en nota', 'Copiar', 'Borrar']
    record(
      'menú de tarjeta',
      expected.every((l) => labels.includes(l)),
      { faltan: expected.filter((l) => !labels.includes(l)) }
    )
    await win.keyboard.press('Escape')
  }
}

async function main(): Promise<void> {
  if (!built()) {
    console.error('Falta out/. Ejecuta antes: npx electron-vite build')
    process.exit(2)
  }
  mkdirSync(SHOTS, { recursive: true })
  const { home, workspace } = createHome([])
  const { app, win } = await launch(home)
  try {
    await openBoard(app, win, 'interact')
    await run(win, join(workspace, 'interact.canvas'))
  } catch (e) {
    record('ejecución', false, String((e as Error).message ?? e).slice(0, 300))
  } finally {
    await Promise.race([app.close(), new Promise((r) => setTimeout(r, 5000))])
    rmSync(home, { recursive: true, force: true })
  }
  mkdirSync(join(HERE, 'results'), { recursive: true })
  const at = new Date().toISOString()
  writeFileSync(
    join(HERE, 'results', `interact-${at.replace(/[:.]/g, '-')}.json`),
    JSON.stringify({ at, checks }, null, 2)
  )
  const failed = checks.filter((c) => !c.ok).length
  process.stdout.write(`${checks.length - failed} de ${checks.length} bien\n`)
  if (failed) process.exitCode = 1
}

await main()
