import { useState } from 'react'
import type { Settings, SettingsInput } from '@shared/consultora'
import { ApiKeyForm } from '../../molecules/ApiKeyForm'
import { TestResult } from '../../molecules/TestResult'
import { Field, Section } from '../../ui'

const INPUT = 'bg-transparent text-[14px] text-ob-text outline-none placeholder:text-ob-faint'

export function ApolloSettings({
  settings,
  onSave,
  onTest
}: {
  settings: Settings
  onSave: (patch: SettingsInput) => Promise<boolean>
  onTest: () => Promise<{ ok: boolean; message: string }>
}): React.JSX.Element {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const test = async (): Promise<void> => setResult(await onTest())

  return (
    <Section title="Apollo · outreach en frío">
      <div className="flex flex-col gap-2">
        <ApiKeyForm
          label="API key maestra"
          hasKey={settings.hasApolloKey}
          hint={settings.apolloKeyHint}
          placeholder="Apollo, Settings, Integrations, API"
          onSave={async (key) => {
            const ok = await onSave({ apolloApiKey: key })
            if (ok) await test()
            return ok
          }}
          onTest={() => void test()}
          onRemove={() => void onSave({ apolloApiKey: '' }).then(() => setResult(null))}
        />
        <TestResult result={result} />

        <div className="grid grid-cols-[160px_1fr] gap-2">
          <Field label="Tope de inscritos por día">
            <input
              key={`cap-${settings.outreachDailyCap}`}
              type="number"
              min={1}
              max={1000}
              defaultValue={settings.outreachDailyCap}
              onBlur={(e) => {
                const value = Number(e.target.value)
                if (value !== settings.outreachDailyCap) void onSave({ outreachDailyCap: value })
              }}
              className={INPUT}
            />
          </Field>
          <Field label="Pie legal de cada correo: dirección física y cómo darse de baja">
            <textarea
              key={`footer-${settings.outreachFooter}`}
              defaultValue={settings.outreachFooter}
              rows={2}
              placeholder={
                'Ali Muñoz Advisory, calle y ciudad.\nSi no quieres más correos, responde «baja».'
              }
              onBlur={(e) =>
                e.target.value !== settings.outreachFooter &&
                void onSave({ outreachFooter: e.target.value })
              }
              className={`${INPUT} resize-none`}
            />
          </Field>
        </div>

        <p className="px-1 text-caption text-ob-muted">
          Apollo envía desde los buzones que conectaste en Apollo. Usa dominios secundarios
          calentados, nunca tu dominio principal. Después asigna Apollo al rol Outreach en frío.
        </p>
      </div>
    </Section>
  )
}
