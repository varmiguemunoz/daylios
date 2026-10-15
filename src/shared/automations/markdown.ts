import { escapeHtml } from './template'

const inline = (text: string): string =>
  escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')

export function markdownToHtml(markdown: string): string {
  const blocks = markdown.replace(/\r\n/g, '\n').split(/\n{2,}/)
  return blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n')
      const heading = /^(#{1,3})\s+(.*)$/.exec(block)
      if (heading && lines.length === 1) {
        const level = heading[1].length
        return `<h${level}>${inline(heading[2])}</h${level}>`
      }
      if (lines.every((l) => /^\s*[-*]\s+/.test(l)))
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`
      if (lines.every((l) => /^\s*\d+\.\s+/.test(l)))
        return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('')}</ol>`
      return `<p>${lines.map(inline).join('<br>')}</p>`
    })
    .join('\n')
}
