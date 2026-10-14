import { useCallback, useState } from 'react'
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import { useLoad } from '../../lib'
import { itemUrl, ws } from '../lib'
import { RibbonButton } from '../../shell/RibbonButton'

const STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]

export function ImagePane({ id, onGone }: { id: string; onGone: () => void }): React.JSX.Element {
  const load = useCallback(() => ws.get(id), [id])
  const { data: item, error } = useLoad(load)
  const [zoom, setZoom] = useState<number | null>(null) // null = ajustar
  const [natural, setNatural] = useState(0)

  const step = (dir: 1 | -1): void => {
    const current = zoom ?? 1
    const next =
      dir > 0 ? STEPS.find((s) => s > current) : [...STEPS].reverse().find((s) => s < current)
    setZoom(next ?? current)
  }

  if (error && !item) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[14px] text-ob-faint">
        {error}
        <button type="button" onClick={onGone} className="text-ob-accent hover:underline">
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className="min-h-0 flex-1 overflow-auto p-6"
        onWheel={(e) => {
          if (e.metaKey || e.ctrlKey) step(e.deltaY < 0 ? 1 : -1)
        }}
      >
        {item && (
          <div className={zoom === null ? 'grid size-full place-items-center' : 'w-fit'}>
            <img
              src={itemUrl(item.id, item.updatedAt)}
              alt={item.name}
              draggable={false}
              onLoad={(e) => setNatural(e.currentTarget.naturalWidth)}
              style={
                zoom === null || !natural ? undefined : { width: natural * zoom, maxWidth: 'none' }
              }
              className={zoom === null ? 'max-h-full max-w-full object-contain' : ''}
            />
          </div>
        )}
      </div>
      <div className="absolute right-4 bottom-4 flex items-center gap-0.5 rounded-[6px] border border-ob-border bg-ob-alt p-1">
        <RibbonButton label="Alejar" onClick={() => step(-1)}>
          <ZoomOut size={15} />
        </RibbonButton>
        <button
          type="button"
          onClick={() => setZoom(zoom === null ? 1 : null)}
          title={zoom === null ? 'Tamaño real' : 'Ajustar al panel'}
          className="h-7 min-w-14 rounded-[4px] px-2 text-[12px] text-ob-muted tabular-nums hover:bg-ob-hover hover:text-ob-text"
        >
          {zoom === null ? 'Ajustar' : `${Math.round(zoom * 100)} %`}
        </button>
        <RibbonButton label="Acercar" onClick={() => step(1)}>
          <ZoomIn size={15} />
        </RibbonButton>
        <RibbonButton label="Ajustar al panel" onClick={() => setZoom(null)}>
          <Maximize size={14} />
        </RibbonButton>
      </div>
    </div>
  )
}
