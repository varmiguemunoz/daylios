import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { todayKey } from '@shared/tasks'
import { api, attempt, money, shortDate, useLoad, type Go } from '../lib'
import { ErrorNote, Page } from '../ui'

/** Tablero por etapas. Cambiar de etapa: en el detalle del prospecto (sin arrastrar en el MVP). */
export function Pipeline({ go }: { go: Go }): React.JSX.Element {
  const load = useCallback(() => api.pipeline(), [])
  const { data, error: loadError } = useLoad(load)
  const [company, setCompany] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const today = todayKey()

  const create = async (): Promise<void> => {
    if (!company?.trim()) return setCompany(null)
    let id = ''
    const failed = await attempt(async () => {
      id = (await api.createProspect({ company })).id
    })
    setError(failed)
    if (!failed) go({ name: 'prospect', id })
  }

  return (
    <Page
      title="Pipeline"
      meta={data && <span>{money(data.openValueUsd)} en etapas abiertas</span>}
      actions={
        <button
          type="button"
          onClick={() => setCompany('')}
          className="flex h-9 items-center gap-1.5 rounded-full bg-apricot pr-4 pl-3 text-caption font-extrabold text-ink transition-transform active:scale-95"
        >
          <Plus size={16} strokeWidth={3} />
          Nuevo prospecto
        </button>
      }
    >
      {company !== null && (
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <input
            autoFocus
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setCompany(null)}
            placeholder="Empresa o persona y Enter"
            aria-label="Empresa del prospecto"
            className="h-[52px] w-full rounded-lg bg-surface px-5 text-body outline-none focus:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]"
          />
        </form>
      )}
      <ErrorNote message={error ?? loadError} />

      <div className="no-scrollbar -mr-10 mt-6 flex gap-3 overflow-x-auto pr-10 pb-2">
        {data?.stages.map((stage) => (
          <section key={stage.id} className="flex w-60 shrink-0 flex-col" aria-label={stage.name}>
            <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
              <h2
                className={`truncate text-caption font-extrabold ${stage.kind === 'won' ? 'text-mint' : stage.kind === 'lost' ? 'text-milk-soft' : ''}`}
              >
                {stage.name}{' '}
                <span className="font-bold text-milk-soft">{stage.prospects.length}</span>
              </h2>
              {stage.valueUsd > 0 && (
                <span className="text-micro font-bold text-milk-soft">{money(stage.valueUsd)}</span>
              )}
            </div>
            <div className="flex min-h-24 flex-col gap-1.5 rounded-md bg-surface/50 p-1.5">
              {stage.prospects.map((p) => {
                const late =
                  p.nextStepDate !== null && p.nextStepDate < today && stage.kind === 'open'
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => go({ name: 'prospect', id: p.id })}
                    className="rounded-sm bg-surface px-3.5 py-3 text-left transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised"
                  >
                    <span className="block truncate text-list font-bold">{p.company}</span>
                    {p.valueUsd !== null && (
                      <span className="block text-caption text-milk-soft">{money(p.valueUsd)}</span>
                    )}
                    {p.nextStep && (
                      <span
                        className={`mt-1.5 block text-micro font-semibold ${late ? 'text-butter' : 'text-milk-soft'}`}
                      >
                        {p.nextStepDate && `${shortDate(p.nextStepDate)} · `}
                        {p.nextStep}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </Page>
  )
}
