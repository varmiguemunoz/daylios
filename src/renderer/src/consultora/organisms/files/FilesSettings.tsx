import { useCallback } from 'react'
import { RotateCcw } from 'lucide-react'
import { useLoad, shortDate } from '../../lib'
import { ErrorNote, List, Section } from '../../ui'
import { SettingRow, Toggle } from '../../molecules/SettingRow'
import { syncApi } from '../sync/useSync'
import { filesApi, useFilesStatus } from './useFiles'

const gb = (bytes: number): string =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : `${Math.round(bytes / 1024 ** 2)} MB`

export function FilesSettings(): React.JSX.Element {
  const status = useFilesStatus()
  const usageLoad = useCallback(() => filesApi.usage(), [])
  const { data: usage, error } = useLoad(usageLoad)
  const trashLoad = useCallback(() => filesApi.trash(), [])
  const { data: trash, reload } = useLoad(trashLoad)
  const share = usage && usage.limitBytes ? Math.min(1, usage.bytes / usage.limitBytes) : 0

  return (
    <Section title="Archivos">
      <ErrorNote message={error ?? status.error} />
      {usage && (
        <SettingRow
          name="Espacio usado"
          description={`Hasta ${gb(usage.maxFileBytes)} por archivo.`}
        >
          <div className="flex w-[220px] flex-col gap-1">
            <span className="text-right text-[13px] text-ob-text tabular-nums">
              {gb(usage.bytes)} de {gb(usage.limitBytes)}
            </span>
            <div
              className="h-1.5 rounded-full bg-ob-active"
              role="meter"
              aria-valuenow={Math.round(share * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Espacio usado"
            >
              <div
                className={`h-full rounded-full ${share > 0.9 ? 'bg-ob-yellow' : 'bg-ob-accent'}`}
                style={{ width: `${share * 100}%` }}
              />
            </div>
          </div>
        </SettingRow>
      )}
      <SettingRow
        name="Sincronizar grabaciones"
        description="Audio y video de reuniones. Ocupan mucho espacio; por defecto solo viajan las transcripciones."
      >
        <Toggle
          label="Sincronizar grabaciones"
          checked={status.recordings}
          onChange={(on) => void filesApi.setRecordings(on)}
        />
      </SettingRow>
      {trash && trash.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[12px] font-medium text-ob-faint">
            Papelera de la organización · 30 días
          </p>
          <List>
            {trash.map((f) => (
              <li key={f.id} className="flex min-h-9 items-center gap-3 px-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-ob-text">{f.path}</span>
                <span className="shrink-0 text-[12px] text-ob-muted">{shortDate(f.deletedAt)}</span>
                <button
                  type="button"
                  onClick={() => void syncApi.restore('file_manifest', f.id).then(() => reload())}
                  className="flex shrink-0 items-center gap-1 text-[12px] text-ob-link transition-colors hover:text-ob-text"
                >
                  <RotateCcw size={12} />
                  Restaurar
                </button>
              </li>
            ))}
          </List>
        </div>
      )}
    </Section>
  )
}
