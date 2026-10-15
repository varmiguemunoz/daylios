const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/

export function sectionOf(body: string, subpath: string | undefined): string {
  if (!subpath?.startsWith('#') || subpath.startsWith('#^')) return body
  const target = subpath
    .slice(1)
    .split('#')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .pop()
  if (!target) return body
  const lines = body.split('\n')
  let start = -1
  let level = 0
  for (let i = 0; i < lines.length; i++) {
    const m = HEADING.exec(lines[i])
    if (!m) continue
    if (start === -1) {
      if (m[2].trim().toLowerCase() === target) {
        start = i
        level = m[1].length
      }
    } else if (m[1].length <= level) {
      return lines.slice(start, i).join('\n').trimEnd()
    }
  }
  return start === -1 ? body : lines.slice(start).join('\n').trimEnd()
}
