import {
  DEFAULT_LINE_HEIGHT,
  DEFAULT_SIZE,
  type TextFont,
  type TextStyle
} from '@shared/canvas-style'

const FONT_STACK: Record<TextFont, string> = {
  sans: 'var(--font-ob)',
  serif: "ui-serif, Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'SF Mono', Menlo, monospace"
}

export const fontStack = (font: TextFont): string => FONT_STACK[font]

export function textVars(style: TextStyle | undefined): React.CSSProperties | undefined {
  if (!style) return undefined
  const size = style.size ?? DEFAULT_SIZE
  const lineHeight = style.lineHeight ?? DEFAULT_LINE_HEIGHT
  return {
    '--ob-font': FONT_STACK[style.font ?? 'sans'],
    '--ob-text-size': `${size}px`,
    '--ob-text-lh': `${Math.round(size * lineHeight)}px`,
    ...(style.align ? { textAlign: style.align } : {})
  } as React.CSSProperties
}
