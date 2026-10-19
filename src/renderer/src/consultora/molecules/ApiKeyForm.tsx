import { useState } from 'react'
import { Button, Field } from '../ui'

const INPUT = 'bg-transparent text-[14px] text-ob-text outline-none placeholder:text-ob-faint'

export function ApiKeyForm({
  label,
  hasKey,
  hint,
  placeholder,
  onSave,
  onTest,
  onRemove
}: {
  label: string
  hasKey: boolean
  hint: string
  placeholder: string
  onSave: (key: string) => Promise<boolean>
  onTest: () => void
  onRemove: () => void
}): React.JSX.Element {
  const [key, setKey] = useState('')
  const submit = async (): Promise<void> => {
    if (key.trim() && (await onSave(key.trim()))) setKey('')
  }
  return (
    <form
      className="flex items-stretch gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div className="min-w-0 flex-1">
        <Field label={hasKey ? `${label} · guardada (${hint})` : `${label} · falta`}>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={hasKey ? 'Pega otra para reemplazarla' : placeholder}
            autoComplete="off"
            spellCheck={false}
            className={INPUT}
          />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <Button kind="primary" disabled={!key.trim()} onClick={() => void submit()}>
          Guardar
        </Button>
        {hasKey && (
          <>
            <Button onClick={onTest}>Probar</Button>
            <Button kind="danger" onClick={onRemove}>
              Quitar
            </Button>
          </>
        )}
      </div>
    </form>
  )
}
