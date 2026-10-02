import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownProps {
  text: string
  /** Solo marcas en línea (negrita, cursiva, tachado, código, enlaces). Para títulos de tarea. */
  inline?: boolean
  /** Si se pasa, las casillas `- [ ]` se pueden marcar: recibe la línea (1-based) de la casilla. */
  onToggleTask?: (line: number) => void
}

/** Enlaces: se abren en el navegador del sistema (ver window.ts) y no disparan el clic de la fila. */
const link: Components['a'] = ({ href, children }) => (
  <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
    {children}
  </a>
)

const BLOCK: Components = { a: link }

/** Casillas marcables: el clic en la casilla avisa con la línea del markdown donde está. */
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

/** En modo inline el párrafo no crea un bloque: el texto queda dentro de la línea. */
const INLINE: Components = { a: link, p: ({ children }) => <>{children}</> }
const INLINE_TAGS = ['p', 'strong', 'em', 'del', 'code', 'a']

/**
 * Markdown (GFM: tablas, listas de tareas, tachado, autoenlaces) a React.
 * No interpreta HTML crudo: lo que escribas se muestra, no se ejecuta.
 * Los estilos viven en main.css (`.md` y `.md-inline`).
 */
export function Markdown({ text, inline = false, onToggleTask }: MarkdownProps): React.JSX.Element {
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
        components={onToggleTask ? taskComponents(onToggleTask) : BLOCK}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
