import { useCallback, useState } from 'react'
import { Copy, Link2, Mail, RotateCw, X } from 'lucide-react'
import {
  INVITABLE_ROLES,
  ROLE_LABEL,
  can,
  canAssignRole,
  type ActorRef,
  type OrgDetail,
  type Role
} from '@shared/organizations'
import { useLoad, shortDate } from '../../lib'
import { Button, EditableText, ErrorNote, INPUT, List, Section, Select } from '../../ui'
import { SettingRow } from '../../molecules/SettingRow'
import { useAccount } from '../account/useAccount'
import { forgetMembers, orgsApi } from './useOrgs'

const roleOptions = (roles: Role[]): { value: string; label: string }[] =>
  roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))

export function OrgSettings(): React.JSX.Element | null {
  const account = useAccount()
  const load = useCallback(() => orgsApi.detail(), [])
  const { data, error: loadError, reload } = useLoad(load)
  const [detail, setDetail] = useState<OrgDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [confirm, setConfirm] = useState('')
  const [transferTo, setTransferTo] = useState('')

  const org = detail ?? data
  if (!org) return <ErrorNote message={loadError} />
  const me: ActorRef = { role: org.me, userId: account.user?.id ?? '' }

  const act = async <T,>(work: () => Promise<T>, done?: (result: T) => void): Promise<void> => {
    try {
      const result = await work()
      setError(null)
      if (result && typeof result === 'object' && 'members' in (result as object)) {
        setDetail(result as unknown as OrgDetail)
        forgetMembers()
      }
      done?.(result)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const share = async (link: string, emailed: boolean): Promise<void> => {
    await navigator.clipboard.writeText(link).catch(() => undefined)
    setNotice(
      emailed
        ? 'Invitación enviada. También copiamos el enlace.'
        : 'Enlace copiado. Caduca en 7 días.'
    )
    setDetail(null)
    await reload()
  }

  const invite = (withEmail: boolean): Promise<void> =>
    act(
      () => orgsApi.invite({ email: withEmail ? email : null, role }),
      (r) => {
        setEmail('')
        void share(r.link, r.emailed)
      }
    )

  const others = org.members.filter((m) => m.userId !== me.userId)

  return (
    <>
      <ErrorNote message={error ?? loadError} />
      {notice && <p className="mt-2 text-[14px] text-ob-green">{notice}</p>}

      <Section title="Organización">
        <SettingRow
          name="Nombre"
          description={`Plan ${org.plan}. Hasta ${org.limits.members} miembros.`}
        >
          {can(me, 'org.rename') ? (
            <EditableText
              value={org.name}
              label="Nombre de la organización"
              onSave={(n) => void act(() => orgsApi.rename(n))}
            />
          ) : (
            <span className="text-[14px] text-ob-text">{org.name}</span>
          )}
        </SettingRow>
      </Section>

      <Section title={`Miembros · ${org.members.length}`}>
        <List>
          {org.members.map((m) => {
            const target: ActorRef = { role: m.role, userId: m.userId }
            const editable = can(me, 'member.role', target)
            return (
              <li key={m.userId} className="flex min-h-11 items-center gap-3 px-2">
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-ob-accent/15 text-[11px] font-semibold text-ob-link"
                >
                  {m.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ob-text">
                    {m.name ?? m.email}
                    {m.userId === me.userId && <span className="text-ob-muted"> · tú</span>}
                  </span>
                  {m.name && (
                    <span className="block truncate text-[12px] text-ob-muted">{m.email}</span>
                  )}
                </span>
                {editable ? (
                  <Select
                    label={`Rol de ${m.name ?? m.email}`}
                    value={m.role}
                    onChange={(r) => void act(() => orgsApi.changeRole(m.userId, r as Role))}
                    options={roleOptions(INVITABLE_ROLES.filter((r) => canAssignRole(me, r)))}
                  />
                ) : (
                  <span className="shrink-0 text-[13px] text-ob-muted">{ROLE_LABEL[m.role]}</span>
                )}
                {can(me, 'member.remove', target) && (
                  <button
                    type="button"
                    aria-label={`Quitar a ${m.name ?? m.email}`}
                    onClick={() => void act(() => orgsApi.removeMember(m.userId))}
                    className="grid size-7 place-items-center rounded-[4px] text-ob-faint transition-colors hover:bg-ob-red/15 hover:text-ob-red"
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            )
          })}
        </List>
      </Section>

      {can(me, 'member.invite') && (
        <Section title="Invitar">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (email.trim()) void invite(true)
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@empresa.com"
              aria-label="Email de la persona"
              className={`${INPUT} min-w-[220px] flex-1`}
            />
            <Select
              label="Rol"
              value={role}
              onChange={(r) => setRole(r as Role)}
              options={roleOptions(INVITABLE_ROLES.filter((r) => canAssignRole(me, r)))}
            />
            <Button kind="primary" disabled={!email.trim()} onClick={() => void invite(true)}>
              <Mail size={14} />
              Invitar
            </Button>
            <Button onClick={() => void invite(false)} title="Enlace sin email, de un solo uso">
              <Link2 size={14} />
              Copiar enlace
            </Button>
          </form>
          {org.invitations.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-[12px] font-medium text-ob-faint">Pendientes</p>
              <List>
                {org.invitations.map((i) => (
                  <li key={i.id} className="flex min-h-10 items-center gap-3 px-2">
                    <span className="min-w-0 flex-1 truncate text-[14px] text-ob-text">
                      {i.email ?? 'Enlace sin email'}
                    </span>
                    <span className="shrink-0 text-[12px] text-ob-muted">{ROLE_LABEL[i.role]}</span>
                    <span
                      className={`shrink-0 text-[12px] ${i.status === 'expired' ? 'text-ob-yellow' : 'text-ob-muted'}`}
                    >
                      {i.status === 'expired' ? 'Caducada' : `Hasta ${shortDate(i.expiresAt)}`}
                    </span>
                    <button
                      type="button"
                      aria-label="Reenviar"
                      title="Reenviar con un enlace nuevo"
                      onClick={() =>
                        void act(
                          () => orgsApi.resendInvite(i.id),
                          (r) => void share(r.link, r.emailed)
                        )
                      }
                      className="grid size-7 place-items-center rounded-[4px] text-ob-faint transition-colors hover:bg-ob-hover hover:text-ob-text"
                    >
                      {i.email ? <RotateCw size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      type="button"
                      aria-label="Revocar"
                      title="Revocar"
                      onClick={() => void act(() => orgsApi.revokeInvite(i.id))}
                      className="grid size-7 place-items-center rounded-[4px] text-ob-faint transition-colors hover:bg-ob-red/15 hover:text-ob-red"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </List>
            </div>
          )}
        </Section>
      )}

      <Section title="Zona delicada">
        {can(me, 'org.leave') && (
          <SettingRow
            name="Salir de la organización"
            description="Su copia local en este Mac se mueve a la Papelera."
          >
            <Button kind="danger" onClick={() => void act(() => orgsApi.leave())}>
              Salir
            </Button>
          </SettingRow>
        )}
        {can(me, 'org.transfer') && others.length > 0 && (
          <SettingRow name="Transferir la propiedad" description="Pasas a ser Admin.">
            <Select
              label="Nuevo dueño"
              value={transferTo}
              onChange={setTransferTo}
              options={[
                { value: '', label: 'Elige un miembro' },
                ...others.map((m) => ({ value: m.userId, label: m.name ?? m.email ?? 'Miembro' }))
              ]}
            />
            <Button
              disabled={!transferTo}
              onClick={() => void act(() => orgsApi.transfer(transferTo))}
            >
              Transferir
            </Button>
          </SettingRow>
        )}
        {can(me, 'org.delete') && (
          <SettingRow
            name="Borrar la organización"
            description={`Para todos los miembros. Escribe «${org.name}» para confirmar.`}
          >
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-label="Confirmación"
              placeholder={org.name}
              className={`${INPUT} max-w-[200px]`}
            />
            <Button
              kind="danger"
              disabled={confirm !== org.name}
              onClick={() => void act(() => orgsApi.remove(confirm))}
            >
              Borrar
            </Button>
          </SettingRow>
        )}
      </Section>
    </>
  )
}
