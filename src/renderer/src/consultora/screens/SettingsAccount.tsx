import { useCallback, useEffect } from 'react'
import { Check } from 'lucide-react'
import { EDITIONS, EDITION_INFO } from '@shared/edition'
import { useLoad } from '../lib'
import { Button, ErrorNote, Section } from '../ui'
import { SettingRow } from '../molecules/SettingRow'
import { useAccount, accountApi } from '../organisms/account/useAccount'
import { SignInPanel } from '../organisms/account/SignInPanel'
import { ProfileCard } from '../organisms/account/ProfileCard'
import { DeviceList } from '../organisms/account/DeviceList'
import { DeleteAccount } from '../organisms/account/DeleteAccount'
import { OrgSettings } from '../organisms/orgs/OrgSettings'
import { FilesSettings } from '../organisms/files/FilesSettings'
import { TeamSettings } from '../organisms/presence/TeamSettings'
import { useOrgs } from '../organisms/orgs/useOrgs'

const editionApi = window.api.edition

export function AccountSettings(): React.JSX.Element {
  const account = useAccount()
  const orgs = useOrgs()
  const load = useCallback(() => editionApi.status(), [])
  const { data, error, reload } = useLoad(load)
  useEffect(() => {
    void reload()
  }, [account.status, reload])
  const active = data?.edition ?? 'local'
  const user = account.status === 'signed-in' ? account.user : null

  return (
    <>
      <ErrorNote message={error} />
      {account.notice && <p className="mt-2 text-[14px] text-ob-yellow">{account.notice}</p>}
      {orgs.notice && <p className="mt-2 text-[14px] text-ob-yellow">{orgs.notice}</p>}

      <Section title="Cuenta">
        {user ? (
          <ProfileCard user={user} />
        ) : account.cloudReady ? (
          <SignInPanel state={account} />
        ) : (
          <p className="text-[14px] text-ob-muted">
            Esta copia de Alisuite no tiene la nube configurada. Todo sigue funcionando en Local.
          </p>
        )}
      </Section>

      {user && orgs.active.orgId && <OrgSettings key={orgs.active.orgId} />}
      {user && orgs.active.orgId && <FilesSettings />}
      {user && orgs.active.orgId && <TeamSettings />}

      {user && (
        <>
          <Section title="Dispositivos">
            <DeviceList />
          </Section>
          <Section title="Sesión">
            <SettingRow
              name="Cerrar sesión"
              description="Solo en este Mac. Tus datos se quedan aquí."
            >
              <Button onClick={() => void accountApi.signOut()}>Cerrar sesión</Button>
            </SettingRow>
            <SettingRow
              name="Cerrar sesión en todos los demás"
              description="Los demás dispositivos tendrán que volver a entrar."
            >
              <Button onClick={() => void accountApi.signOutEverywhere()}>Cerrar en todos</Button>
            </SettingRow>
            <SettingRow name="Borrar cuenta">
              <DeleteAccount />
            </SettingRow>
          </Section>
        </>
      )}

      <Section title="Ediciones">
        <div className="grid gap-3 @2xl:grid-cols-2">
          {EDITIONS.map((edition) => {
            const info = EDITION_INFO[edition]
            const on = edition === active
            return (
              <div
                key={edition}
                aria-current={on ? 'true' : undefined}
                className={`rounded-[8px] border px-4 py-3 ${
                  on ? 'border-ob-accent bg-ob-accent/5' : 'border-ob-border bg-ob-alt'
                }`}
              >
                <p className="flex items-center justify-between text-[15px] font-semibold text-ob-text">
                  {info.label}
                  {on && (
                    <span className="flex items-center gap-1 text-[12px] font-medium text-ob-link">
                      <Check size={13} />
                      Activa
                    </span>
                  )}
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-[13px] text-ob-muted">
                  {info.includes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-[13px] text-ob-faint">
          Iniciar sesión activa Equipo. Nada se sube sin que lo confirmes y tus claves de API no
          salen de este Mac.
        </p>
      </Section>
    </>
  )
}
