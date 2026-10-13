import { normalizeName, type ProspectCard, type StageKind } from './consultora'

/** Filtros del pipeline (panel lateral). Puros: los usa el tablero y la lista. */
export interface PipelineFilters {
  /** Empresa, contacto, notas o próximo paso. */
  query: string
  /** Slugs: el prospecto debe tener todos (por sus contactos). */
  tags: string[]
  /** Tipos de etapa visibles. Vacío = todos. */
  kinds: StageKind[]
  /** Solo con el próximo paso vencido. */
  overdue: boolean
  /** Valor mínimo en USD. null = sin mínimo. */
  minValue: number | null
}

export const EMPTY_PIPELINE_FILTERS: PipelineFilters = {
  query: '',
  tags: [],
  kinds: [],
  overdue: false,
  minValue: null
}

/** Cuántos filtros hay activos (el número del botón «Filtros»; la búsqueda no cuenta). */
export function activePipelineFilters(f: PipelineFilters): number {
  return f.tags.length + (f.kinds.length ? 1 : 0) + (f.overdue ? 1 : 0) + (f.minValue !== null ? 1 : 0)
}

/** ¿La tarjeta pasa los filtros? `kind` = tipo de su etapa; `today` = YYYY-MM-DD local. */
export function matchesProspect(card: ProspectCard, kind: StageKind, f: PipelineFilters, today: string): boolean {
  if (f.kinds.length && !f.kinds.includes(kind)) return false
  if (f.overdue && !(kind === 'open' && card.nextStepDate !== null && card.nextStepDate < today)) return false
  if (f.minValue !== null && (card.valueUsd ?? 0) < f.minValue) return false
  if (f.tags.length && !f.tags.every((t) => card.tags.some((x) => x.slug === t))) return false
  const q = normalizeName(f.query)
  if (q) {
    const text = normalizeName(
      [card.company, card.contact?.name, card.notesMd, card.nextStep, card.contactMd].filter(Boolean).join(' ')
    )
    if (!text.includes(q)) return false
  }
  return true
}
