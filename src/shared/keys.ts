const NAMES: Record<string, string> = { '⌘': 'Ctrl', '⌃': 'Ctrl', '⌥': 'Alt', '⇧': 'Shift' }

export function keyLabel(text: string, platform: string): string {
  if (platform === 'darwin') return text
  return text
    .replace(/([⌘⌃⌥⇧]) (?=\p{Ll})/gu, (_m, symbol: string) => `${NAMES[symbol]} `)
    .replace(/([⌘⌃⌥⇧]) ?/gu, (_m, symbol: string) => `${NAMES[symbol]}+`)
    .replace(/↵/g, 'Enter')
}
