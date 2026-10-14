import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { resolveLink } from '@shared/vault-links'
import { vaultUrl } from '@shared/workspace'

interface MarkdownProps {
  text: string

  inline?: boolean

  onToggleTask?: (line: number) => void

  imageBase?: string
}

const link: Components['a'] = ({ href, children }) => (
  <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
    {children}
  </a>
)

const BLOCK: Components = { a: link }

function vaultImage(base: string): Components['img'] {
  return function VaultImage({ src, alt }) {
    const raw = typeof src === 'string' ? src : ''
    const path = resolveLink(raw, base)
    return (
      <img src={path ? vaultUrl(path) : raw} alt={alt ?? ''} loading="lazy" draggable={false} />
    )
  }
}

function taskComponents(onToggleTask: (line: number) => void): Components {
  return {
    a: link,
    li: ({ node, className, children, ...props }) => {
      const line = node?.position?.start.line
      const isTask = className?.includes('task-list-item')
      return (
        <li
          className={className}
          {...props}
          onClick={(e) => {
            if (!isTask || !line || (e.target as HTMLElement).tagName !== 'INPUT') return
            e.stopPropagation() // listas anidadas: solo la casilla pulsada
            onToggleTask(line)
          }}
        >
          {children}
        </li>
      )
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    input: ({ node: _node, ...props }) => <input {...props} disabled={false} readOnly />
  }
}

const INLINE: Components = { a: link, p: ({ children }) => <>{children}</> }
const INLINE_TAGS = ['p', 'strong', 'em', 'del', 'code', 'a']

export function Markdown({
  text,
  inline = false,
  onToggleTask,
  imageBase
}: MarkdownProps): React.JSX.Element {
  if (inline) {
    return (
      <span className="md-inline">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={INLINE}
          allowedElements={INLINE_TAGS}
          unwrapDisallowed
        >
          {text}
        </ReactMarkdown>
      </span>
    )
  }

  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          ...(onToggleTask ? taskComponents(onToggleTask) : BLOCK),
          ...(imageBase !== undefined ? { img: vaultImage(imageBase) } : {})
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
