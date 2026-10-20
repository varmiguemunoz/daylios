const FRAME_STYLE =
  '<style>body{margin:0;padding:12px 14px;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1f1f1f;background:#fff}a{color:#5b3bd6}p,div{margin:0 0 6px}</style>'

export function HtmlPreview({
  html,
  title,
  height = 260
}: {
  html: string
  title: string
  height?: number
}): React.JSX.Element {
  return (
    <iframe
      title={title}
      sandbox=""
      srcDoc={`<!doctype html><html><head><meta charset="utf-8">${FRAME_STYLE}</head><body>${html}</body></html>`}
      style={{ height }}
      className="w-full rounded-[6px] border border-ob-border bg-white"
    />
  )
}
