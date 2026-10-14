import { describe, expect, it } from 'vitest'
import type { ProspectCard } from '../shared/consultora'
import {
  EMPTY_PIPELINE_FILTERS,
  activePipelineFilters,
  matchesProspect
} from '../shared/pipeline-filters'

const card = (over: Partial<ProspectCard> = {}): ProspectCard => ({
  id: 'p1',
  company: 'Acme Construcción',
  contactMd: '',
  valueUsd: 5000,
  source: null,
  stageId: 's1',
  position: 0,
  notesMd: '',
  nextStep: 'Enviar propuesta',
  nextStepDate: '2026-10-10',
  clientId: null,
  closedAt: null,
  assigneeId: null,
  createdAt: '',
  updatedAt: '',
  contact: { id: 'c1', name: 'Ana' },
  tags: [{ slug: 'webinar', name: 'webinar' }],
  ...over
})
const today = '2026-10-13'

describe('filtros del pipeline', () => {
  it('sin filtros pasa todo', () => {
    expect(matchesProspect(card(), 'open', EMPTY_PIPELINE_FILTERS, today)).toBe(true)
  })
  it('busca sin acentos en empresa y contacto', () => {
    expect(
      matchesProspect(card(), 'open', { ...EMPTY_PIPELINE_FILTERS, query: 'construccion' }, today)
    ).toBe(true)
    expect(
      matchesProspect(card(), 'open', { ...EMPTY_PIPELINE_FILTERS, query: 'ana' }, today)
    ).toBe(true)
    expect(
      matchesProspect(card(), 'open', { ...EMPTY_PIPELINE_FILTERS, query: 'zeta' }, today)
    ).toBe(false)
  })
  it('tags: deben estar todos', () => {
    const f = { ...EMPTY_PIPELINE_FILTERS, tags: ['webinar', 'otro'] }
    expect(matchesProspect(card(), 'open', f, today)).toBe(false)
    expect(activePipelineFilters(f)).toBe(2)
  })
  it('vencido solo cuenta en etapas abiertas', () => {
    const f = { ...EMPTY_PIPELINE_FILTERS, overdue: true }
    expect(matchesProspect(card(), 'open', f, today)).toBe(true)
    expect(matchesProspect(card(), 'won', f, today)).toBe(false)
  })
  it('valor mínimo y tipo de etapa', () => {
    expect(
      matchesProspect(card(), 'open', { ...EMPTY_PIPELINE_FILTERS, minValue: 6000 }, today)
    ).toBe(false)
    expect(
      matchesProspect(card(), 'lost', { ...EMPTY_PIPELINE_FILTERS, kinds: ['open'] }, today)
    ).toBe(false)
  })
})
