import { normalizePath, relativePath } from './workspace'

const LINK = /(!?\[[^\]\n]*\]\()(<[^>\n]+>|[^)\s]+)((?:\s+"[^"\n]*")?\))/g

const isExternal = (url: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#')

const unwrap = (url: string): string => (url.startsWith('<') ? url.slice(1, -1) : url)

function decode(url: string): string {
  try {
    return decodeURI(url)
  } catch {
    return url
  }
}

const encode = (path: string): string =>
  path.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')

export function resolveLink(url: string, noteDir: string): string | null {
  const raw = unwrap(url)
  if (isExternal(raw)) return null
  const path = decode(raw.split('#')[0])
  if (!path) return null
  return normalizePath(noteDir ? `${noteDir}/${path}` : path)
}

export function noteRefs(markdown: string, noteDir: string): string[] {
  const out = new Set<string>()
  for (const m of markdown.matchAll(LINK)) {
    const path = resolveLink(m[2], noteDir)
    if (path) out.add(path)
  }
  return [...out]
}

export function rewriteMarkdownLinks(
  markdown: string,
  oldDir: string,
  newDir: string,
  moved: Map<string, string>
): string {
  return markdown.replace(LINK, (whole, open: string, url: string, close: string) => {
    const target = resolveLink(url, oldDir)
    if (target === null) return whole
    const next = moved.get(target) ?? target
    if (next === target && oldDir === newDir) return whole
    const hash = unwrap(url).includes('#') ? unwrap(url).slice(unwrap(url).indexOf('#')) : ''
    return `${open}${encode(relativePath(newDir, next))}${hash}${close}`
  })
}
