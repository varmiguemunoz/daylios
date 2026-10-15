export const TEXT_FONTS = ['sans', 'serif', 'mono'] as const
export const TEXT_SIZES = [12, 14, 16, 20, 24, 32, 40] as const
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const
export const LINE_HEIGHTS = [1.2, 1.5, 2] as const

export type TextFont = (typeof TEXT_FONTS)[number]
export type TextAlign = (typeof TEXT_ALIGNS)[number]

export interface TextStyle {
  font?: TextFont
  size?: number
  align?: TextAlign
  lineHeight?: number
}

export const DEFAULT_SIZE = 16
export const DEFAULT_LINE_HEIGHT = 1.5

const has = <T>(list: readonly T[], value: unknown): value is T => list.includes(value as T)

export function normalizeStyle(raw: unknown): TextStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const s = raw as Record<string, unknown>
  const out: TextStyle = {}
  if (has(TEXT_FONTS, s.font) && s.font !== 'sans') out.font = s.font
  if (has(TEXT_SIZES, s.size) && s.size !== DEFAULT_SIZE) out.size = s.size
  if (has(TEXT_ALIGNS, s.align) && s.align !== 'left') out.align = s.align
  if (has(LINE_HEIGHTS, s.lineHeight) && s.lineHeight !== DEFAULT_LINE_HEIGHT)
    out.lineHeight = s.lineHeight
  return Object.keys(out).length ? out : undefined
}

export function stepSize(size: number | undefined, delta: 1 | -1): number {
  const current = TEXT_SIZES.indexOf((size ?? DEFAULT_SIZE) as (typeof TEXT_SIZES)[number])
  const from = current === -1 ? TEXT_SIZES.indexOf(DEFAULT_SIZE) : current
  return TEXT_SIZES[Math.max(0, Math.min(TEXT_SIZES.length - 1, from + delta))]
}

export function nextLineHeight(lineHeight: number | undefined): number {
  const i = LINE_HEIGHTS.indexOf(
    (lineHeight ?? DEFAULT_LINE_HEIGHT) as (typeof LINE_HEIGHTS)[number]
  )
  return LINE_HEIGHTS[(i + 1) % LINE_HEIGHTS.length]
}

export interface Edit {
  text: string
  start: number
  end: number
}

export function toggleWrap(text: string, start: number, end: number, marker: string): Edit {
  const m = marker.length
  const before = text.slice(start - m, start)
  const after = text.slice(end, end + m)
  if (start >= m && before === marker && after === marker)
    return {
      text: text.slice(0, start - m) + text.slice(start, end) + text.slice(end + m),
      start: start - m,
      end: end - m
    }
  const inner = text.slice(start, end)
  if (inner.length >= m * 2 && inner.startsWith(marker) && inner.endsWith(marker))
    return {
      text: text.slice(0, start) + inner.slice(m, -m) + text.slice(end),
      start,
      end: end - m * 2
    }
  return {
    text: text.slice(0, start) + marker + inner + marker + text.slice(end),
    start: start + m,
    end: end + m
  }
}
