import { useState } from 'react'
import { DELETE_ACCOUNT_CONFIRMATION } from '@shared/account'
import { Button, INPUT } from '../../ui'
import { accountApi } from './useAccount'

export function DeleteAccount(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  if (!open) {
    return (
      <Button kind="danger" onClick={() => setOpen(true)}>
        Borrar cuenta
      </Button>
    )
  }
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-[13px] text-ob-muted">
        Se borran tu cuenta y las organizaciones donde eres el único miembro. Si eres dueño de una
        con más personas, transfiérela o bórrala antes. Lo que hay en este Mac se queda.
      </p>
      <div className="flex gap-2">
        <input
          autoFocus
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={`Escribe ${DELETE_ACCOUNT_CONFIRMATION}`}
          aria-label="Confirmación"
          className={`${INPUT} max-w-[220px]`}
        />
        <Button
          kind="danger"
          disabled={confirm !== DELETE_ACCOUNT_CONFIRMATION}
          onClick={() => void accountApi.deleteAccount(confirm)}
        >
          Borrar para siempre
        </Button>
        <Button onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </div>
  )
}
