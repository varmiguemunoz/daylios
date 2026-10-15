import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makePdf } from './pdf.mts'

export interface BoardSize {
  name: string
  nodes: number
}

export const SIZES: BoardSize[] = [
  { name: 'alfa10', nodes: 10 },
  { name: 'beta200', nodes: 200 },
  { name: 'gamma1000', nodes: 1000 },
  { name: 'delta5000', nodes: 5000 }
]

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

interface Node {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  [key: string]: unknown
}

const card = (i: number, x: number, y: number, w = 250, h = 160, prefix = 'n'): Node => ({
  id: `${prefix}${i}`,
  type: 'text',
  text: `## Tarjeta ${i}\n\nTexto **${i}** con algo de contenido.`,
  x,
  y,
  width: w,
  height: h,
  ...(i % 7 === 0 ? { color: String(1 + (i % 6)) } : {})
})

export function gridBoard(count: number, prefix = 'n'): { nodes: Node[]; edges: unknown[] } {
  const cols = Math.ceil(Math.sqrt(count))
  const nodes = Array.from({ length: count }, (_, i) =>
    card(i, (i % cols) * 400, Math.floor(i / cols) * 300, 250, 160, prefix)
  )
  const edges = nodes.slice(1).map((n, i) => ({ id: `e${i}`, fromNode: nodes[i].id, toNode: n.id }))
  return { nodes, edges }
}

const prefixed = (
  prefix: string,
  board: { nodes: Node[]; edges: { id: string; fromNode: string; toNode: string }[] }
): { nodes: Node[]; edges: unknown[] } => ({
  nodes: board.nodes.map((n) => ({ ...n, id: prefix + n.id })),
  edges: board.edges.map((e) => ({
    ...e,
    id: prefix + e.id,
    fromNode: prefix + e.fromNode,
    toNode: prefix + e.toNode
  }))
})

export function mediaBoard(): { nodes: Node[]; edges: unknown[] } {
  return prefixed('medios-', {
    nodes: [
      { id: 'g1', type: 'group', x: 570, y: -80, width: 90, height: 520, label: 'Grupo' },
      ...Array.from({ length: 6 }, (_, i) => card(i, 640 + (i % 2) * 300, Math.floor(i / 2) * 220)),
      { id: 'f1', type: 'file', file: 'Notas/Nota A.md', x: -400, y: 0, width: 300, height: 260 },
      { id: 'f2', type: 'file', file: 'imagen.png', x: -400, y: 300, width: 200, height: 125 },
      { id: 'f3', type: 'file', file: 'documento.pdf', x: -760, y: 0, width: 320, height: 420 },
      {
        id: 'l1',
        type: 'link',
        url: 'https://jsoncanvas.org',
        x: -760,
        y: 460,
        width: 400,
        height: 300
      }
    ],
    edges: [
      { id: 'm1', fromNode: 'n0', toNode: 'n1', label: 'sigue' },
      { id: 'm2', fromNode: 'f1', toNode: 'n0' }
    ]
  })
}

export function interactBoard(): { nodes: Node[]; edges: unknown[] } {
  const nodes = Array.from({ length: 6 }, (_, i) => ({
    ...card(i, (i % 3) * 400, Math.floor(i / 3) * 300, 260, 140),
    id: `c${i}`
  }))
  nodes.push({ ...card(6, 1213, 77, 260, 140), id: 'c6' })
  return prefixed('interact-', { nodes, edges: [{ id: 'e0', fromNode: 'c0', toNode: 'c1' }] })
}

const json = (v: unknown): string => JSON.stringify(v, null, '\t')

export function writeFixtures(dir: string, sizes: BoardSize[] = SIZES): void {
  mkdirSync(join(dir, 'Notas'), { recursive: true })
  for (const s of sizes)
    writeFileSync(join(dir, `${s.name}.canvas`), json(gridBoard(s.nodes, `${s.name}-`)))
  writeFileSync(join(dir, 'medios.canvas'), json(mediaBoard()))
  writeFileSync(join(dir, 'interact.canvas'), json(interactBoard()))
  writeFileSync(
    join(dir, 'Notas', 'Nota A.md'),
    '# Nota A\n\nUna nota de prueba con **negrita**.\n'
  )
  writeFileSync(join(dir, 'imagen.png'), Buffer.from(PNG, 'base64'))
  writeFileSync(join(dir, 'documento.pdf'), makePdf(2, 'Documento de prueba'))
  writeFileSync(join(dir, 'largo.pdf'), makePdf(300, 'Documento largo'))
}
