const KEEP = new Set([
  'P',
  'DIV',
  'BR',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'A',
  'UL',
  'OL',
  'LI',
  'SPAN'
])
const SAFE_LINK = /^(https?:|mailto:)/i

function clean(node: Node, doc: Document): Node[] {
  if (node.nodeType === Node.TEXT_NODE) return [doc.createTextNode(node.textContent ?? '')]
  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const el = node as Element
  const children = [...el.childNodes].flatMap((child) => clean(child, doc))
  if (['SCRIPT', 'STYLE', 'HEAD', 'TITLE', 'META', 'IFRAME', 'OBJECT'].includes(el.tagName))
    return []
  if (!KEEP.has(el.tagName)) return children
  const out = doc.createElement(el.tagName.toLowerCase())
  if (el.tagName === 'A') {
    const href = el.getAttribute('href') ?? ''
    if (SAFE_LINK.test(href.trim())) out.setAttribute('href', href.trim())
  }
  children.forEach((c) => out.appendChild(c))
  return [out]
}

export function sanitizeEmailHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const box = doc.createElement('div')
  ;[...doc.body.childNodes].flatMap((n) => clean(n, doc)).forEach((n) => box.appendChild(n))
  return box.innerHTML.trim()
}

export const htmlText = (html: string): string =>
  new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? ''
