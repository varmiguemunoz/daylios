import { useEffect, useState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { EMAIL_CODE_COOLDOWN_S, type AccountState } from '@shared/account'
import { Button, INPUT } from '../../ui'
import { accountApi } from './useAccount'

function useCooldown(): [number, () => void] {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!left) return
    const t = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  return [left, () => setLeft(EMAIL_CODE_COOLDOWN_S)]
}

export function SignInPanel({ state }: { state: AccountState }): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, startCooldown] = useCooldown()

  const run = async (work: () => Promise<AccountState>): Promise<AccountState> => {
    setBusy(true)
    try {
      return await work()
    } finally {
      setBusy(false)
    }
  }

  const send = async (to: string): Promise<void> => {
    const next = await run(() => accountApi.sendEmailCode(to))
    if (next.waitingFor === 'email-code') startCooldown()
  }

  if (state.waitingFor === 'browser') {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-ob-border bg-ob-alt px-4 py-3">
        <Loader2 size={16} className="animate-spin text-ob-muted" aria-hidden />
        <p className="flex-1 text-[14px] text-ob-text">
          Termina en el navegador. Al acabar vuelves aquí solo.
        </p>
        <Button onClick={() => void accountApi.cancel()}>Cancelar</Button>
      </div>
    )
  }

  if (state.waitingFor === 'email-code') {
    return (
      <form
        className="flex flex-col gap-2 rounded-[8px] border border-ob-border bg-ob-alt px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault()
          void run(() => accountApi.verifyEmailCode(code))
        }}
      >
        <p className="text-[14px] text-ob-text">Te enviamos un código a {state.email}.</p>
        <div className="flex gap-2">
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="123456"
            aria-label="Código del email"
            className={`${INPUT} max-w-[160px] tracking-[0.2em] tabular-nums`}
          />
          <Button
            kind="primary"
            onClick={() => void run(() => accountApi.verifyEmailCode(code))}
            disabled={busy || code.length < 6}
          >
            Entrar
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-[13px] text-ob-muted">
          <button
            type="button"
            disabled={cooldown > 0 || busy}
            onClick={() => state.email && void send(state.email)}
            className="transition-colors hover:text-ob-text disabled:opacity-50"
          >
            {cooldown > 0 ? `Pedir otro en ${cooldown} s` : 'Pedir otro código'}
          </button>
          <button
            type="button"
            onClick={() => void accountApi.cancel()}
            className="transition-colors hover:text-ob-text"
          >
            Usar otro email
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        kind="primary"
        onClick={() => void run(() => accountApi.signInWithGoogle())}
        disabled={busy || !state.cloudReady}
      >
        Continuar con Google
      </Button>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send(email)
        }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@empresa.com"
          aria-label="Email"
          autoComplete="email"
          disabled={!state.cloudReady}
          className={INPUT}
        />
        <Button
          onClick={() => void send(email)}
          disabled={busy || !email.trim() || !state.cloudReady}
        >
          <Mail size={14} />
          Enviar código
        </Button>
      </form>
      <p className="text-[13px] text-ob-faint">
        Sin contraseñas. Iniciar sesión no sube tus datos: eso es un paso aparte.
      </p>
    </div>
  )
}
