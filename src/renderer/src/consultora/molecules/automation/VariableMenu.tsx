import { Braces } from 'lucide-react'
import { useContextMenu } from '../../../ui'

export interface Variable {
  key: string
  label: string
}

export function VariableMenu({
  variables,
  onPick
}: {
  variables: Variable[]
  onPick: (key: string) => void
}): React.JSX.Element {
  const menu = useContextMenu()
  return (
    <>
      <button
        type="button"
        aria-label="Insertar variable"
        title="Insertar variable"
        disabled={variables.length === 0}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) =>
          menu.openFrom(
            e.currentTarget,
            variables.map((v) => ({
              label: `${v.label}  ·  ${v.key}`,
              onSelect: () => onPick(v.key)
            }))
          )
        }
        className="grid size-7 shrink-0 place-items-center rounded-[4px] text-ob-muted transition-colors hover:bg-ob-active hover:text-ob-text disabled:opacity-30"
      >
        <Braces size={14} aria-hidden />
      </button>
      {menu.element}
    </>
  )
}

export function insertVariable(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  key: string
): string {
  const token = `{{${key}}}`
  if (!el) return `${value}${token}`
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? value.length
  return `${value.slice(0, start)}${token}${value.slice(end)}`
}
