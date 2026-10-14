import { useRef, useState } from 'react'
import { Building2, Check, HardDrive, Plus, Settings2 } from 'lucide-react'
import { initialsOf } from '@shared/account'
import { Button, ErrorNote, INPUT, Modal, useContextMenu, type MenuEntry } from '../../ui'
import { useAccount } from '../account/useAccount'
import { orgsApi, useOrgs } from './useOrgs'
import { syncApi } from '../sync/useSync'
import type { LocalSummary } from '@shared/sync-protocol'

export function OrgSwitcher({ onManage }: { onManage: () => void }): React.JSX.Element | null {
  const account = useAccount()
  const { active, orgs } = useOrgs()
  const menu = useContextMenu()
  const anchor = useRef<HTMLButtonElement>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [bring, setBring] = useState(false)
  const [summary, setSummary] = useState<LocalSummary | null>(null)

  if (account.status !== 'signed-in' && !active.orgId) return null

  const pick = (orgId: string | null): void => {
    if (orgId === active.orgId) return
    void orgsApi.switchTo(orgId).catch((e: Error) => setError(e.message))
  }

  const create = async (): Promise<void> => {
    try {
      await orgsApi.create(name, bring)
      setCreating(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const items: MenuEntry[] = [
    {
      label: 'Local',
      icon: active.orgId ? <HardDrive size={15} /> : <Check size={15} />,
      onSelect: () => pick(null)
    },
    ...orgs.map((o): MenuEntry => ({
      label: o.name,
      icon: o.id === active.orgId ? <Check size={15} /> : <Building2 size={15} />,
      onSelect: () => pick(o.id)
    })),
    null,
    {
      label: 'Crear organización',
      icon: <Plus size={15} />,
      onSelect: () => {
        setName('')
        setError(null)
        setBring(false)
        setSummary(null)
        setCreating(true)
        if (!active.orgId)
          void syncApi
            .localSummary()
            .then(setSummary)
            .catch(() => undefined)
      },
      disabled: account.status !== 'signed-in'
    },
    { label: 'Gestionar', icon: <Settings2 size={15} />, onSelect: onManage }
  ]

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={`Espacio: ${active.name}. Cambiar de organización`}
        title={active.name}
        onClick={() => anchor.current && menu.openFrom(anchor.current, items)}
        className={`grid size-8 place-items-center rounded-[6px] text-[11px] font-semibold transition-colors ${
          active.orgId
            ? 'bg-ob-accent/20 text-ob-link hover:bg-ob-accent/30'
            : 'text-ob-muted hover:bg-ob-hover hover:text-ob-text'
        }`}
      >
        {active.orgId ? initialsOf(active.name, null) : <HardDrive size={16} />}
      </button>
      {menu.element}
      <Modal
        open={creating}
        size="sm"
        title="Crear organización"
        onClose={() => setCreating(false)}
        actions={
          <>
            <Button onClick={() => setCreating(false)}>Cancelar</Button>
            <Button kind="primary" disabled={!name.trim()} onClick={() => void create()}>
              Crear y abrir
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) void create()
          }}
          className="flex flex-col gap-2"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ali Muñoz Advisory"
            aria-label="Nombre de la organización"
            className={INPUT}
          />
          {summary && summary.total > 0 && (
            <fieldset className="flex flex-col gap-1.5 text-[14px] text-ob-text">
              <legend className="mb-1 text-[12px] font-medium text-ob-faint">Para empezar</legend>
              <label className="flex items-center gap-2">
                <input type="radio" checked={!bring} onChange={() => setBring(false)} />
                Vacía
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={bring} onChange={() => setBring(true)} />
                Llevar mis datos de Local: {summary.total} registros y la bóveda
              </label>
            </fieldset>
          )}
          <p className="text-[13px] text-ob-muted">
            Tendrá su propia copia de datos y de bóveda. Local queda intacto. Tus claves de API no
            se suben. La app se reinicia al cambiar de espacio.
          </p>
          <ErrorNote message={error} />
        </form>
      </Modal>
    </>
  )
}
