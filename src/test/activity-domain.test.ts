import { describe, expect, it } from 'vitest'
import { activityPhrase, type ActivityEntry } from '../shared/activity'
import { onlineMembers, PRESENCE_TTL_MS } from '../shared/presence'
import { applyMutation, type Mutation, type RecordState } from '../shared/sync-merge'
import { describeChange, type StageLookup } from '../../services/cloud/src/domain/activity'

const B = '22222222-2222-4222-8222-222222222222'
let tick = 0
const rev = (): string => `${String(1_800_000_000_000 + ++tick).padStart(15, '0')}:0000:dev`

const up = (entity: string, id: string, fields: Record<string, unknown>): Mutation => ({
  entity,
  id,
  op: 'upsert',
  fields,
  rev: rev()
})

const stages: StageLookup = async (id) =>
  id === 'won' ? { name: 'Ganado', kind: 'won' } : { name: 'Propuesta', kind: 'open' }

const run = async (
  m: Mutation,
  before: RecordState | null
): Promise<{
  verbs: string[]
  state: RecordState
  drafts: Awaited<ReturnType<typeof describeChange>>
}> => {
  const state = applyMutation(before, m)
  const drafts = await describeChange(m, before, state, stages)
  return { verbs: drafts.map((d) => d.verb), state, drafts }
}

describe('actividad: qué cuenta como acción', () => {
  it('crear y luego cambiar un cliente', async () => {
    const created = await run(up('clients', 'c1', { name: 'Acme', status: 'activo' }), null)
    expect(created.verbs).toEqual(['created'])
    expect(created.drafts[0].title).toBe('Acme')
    const renamed = await run(up('clients', 'c1', { name: 'Acme SAS' }), created.state)
    expect(renamed.verbs).toEqual(['updated'])
  })

  it('tocar solo posición o fechas internas no es actividad', async () => {
    const created = await run(up('tasks', 't1', { title: 'Llamar', position: 1 }), null)
    const moved = await run(
      up('tasks', 't1', { position: 4, updated_at: '2026-10-14 10:00:00' }),
      created.state
    )
    expect(moved.verbs).toEqual([])
  })

  it('automatizaciones: publicar y pausar cuentan, editar el borrador no', async () => {
    const a = await run(
      up('automations', 'a1', { name: 'Bienvenida', status: 'draft', draft: '{}' }),
      null
    )
    expect(a.verbs).toEqual(['created'])
    const edited = await run(up('automations', 'a1', { draft: '{"root":"n1"}' }), a.state)
    expect(edited.verbs).toEqual([])
    const published = await run(
      up('automations', 'a1', { status: 'active', version_number: 1, version_id: 'v1' }),
      edited.state
    )
    expect(published.verbs).toEqual(['published'])
    expect(published.drafts[0].detail).toBe('v1')
    const paused = await run(up('automations', 'a1', { status: 'paused' }), published.state)
    expect(paused.verbs).toEqual(['paused'])
    const renamed = await run(up('automations', 'a1', { name: 'Hola' }), paused.state)
    expect(renamed.verbs).toEqual(['updated'])
  })

  it('mover a una etapa ganada es ganar, a otra es mover', async () => {
    const p = await run(up('prospects', 'p1', { company: 'Acme', stage_id: 'lead' }), null)
    const moved = await run(up('prospects', 'p1', { stage_id: 'propuesta' }), p.state)
    expect(moved.verbs).toEqual(['moved'])
    expect(moved.drafts[0].detail).toBe('Propuesta')
    const won = await run(up('prospects', 'p1', { stage_id: 'won' }), moved.state)
    expect(won.verbs).toEqual(['won'])
  })

  it('completar y asignar una tarea', async () => {
    const t = await run(up('tasks', 't1', { title: 'Propuesta', status: 'todo' }), null)
    const assigned = await run(up('tasks', 't1', { assignee_id: B }), t.state)
    expect(assigned.verbs).toEqual(['assigned'])
    expect(assigned.drafts[0].targetId).toBe(B)
    const done = await run(up('tasks', 't1', { status: 'done' }), assigned.state)
    expect(done.verbs).toEqual(['completed'])
  })

  it('borrar y restaurar por la columna de papelera', async () => {
    const c = await run(up('clients', 'c1', { name: 'Acme', deleted_at: null }), null)
    const gone = await run(up('clients', 'c1', { deleted_at: '2026-10-14 10:00:00' }), c.state)
    expect(gone.verbs).toEqual(['deleted'])
    const back = await run(up('clients', 'c1', { deleted_at: null }), gone.state)
    expect(back.verbs).toEqual(['restored'])
  })

  it('archivos: subir, renombrar sin contar el contenido, borrar', async () => {
    const f = await run(
      up('file_manifest', 'f1', { path: 'Workspace/Plan.md', hash: 'a'.repeat(64) }),
      null
    )
    expect(f.verbs).toEqual(['uploaded'])
    const renamed = await run(
      up('file_manifest', 'f1', { path: 'Workspace/Plan final.md' }),
      f.state
    )
    expect(renamed.verbs).toEqual(['renamed'])
    expect(renamed.drafts[0]).toMatchObject({ title: 'Plan final.md', detail: 'Plan.md' })
  })

  it('las tablas internas no generan actividad', async () => {
    expect((await run(up('pipeline_stages', 's1', { name: 'Lead' }), null)).verbs).toEqual([])
    expect((await run(up('contact_events', 'e1', { kind: 'open' }), null)).verbs).toEqual([])
  })
})

describe('actividad: frases', () => {
  const entry = (patch: Partial<ActivityEntry>): ActivityEntry => ({
    id: 1,
    seq: 1,
    actorId: 'a',
    verb: 'created',
    entity: 'clients',
    entityId: 'c1',
    title: 'Acme',
    detail: null,
    targetId: null,
    count: 1,
    at: '2026-10-14T10:00:00.000Z',
    ...patch
  })
  const name = (id: string | null): string => (id === 'a' ? 'Ana' : 'Beto')

  it('arma frases legibles', () => {
    expect(activityPhrase(entry({}), name)).toBe('Ana creó el cliente «Acme»')
    expect(activityPhrase(entry({ verb: 'updated', count: 4 }), name)).toBe(
      'Ana cambió el cliente «Acme», 4 veces'
    )
    expect(
      activityPhrase(entry({ verb: 'moved', entity: 'prospects', detail: 'Propuesta' }), name)
    ).toBe('Ana movió el prospecto «Acme» a Propuesta')
    expect(
      activityPhrase(
        entry({ verb: 'assigned', entity: 'tasks', title: 'Llamar', targetId: 'b' }),
        name
      )
    ).toBe('Ana asignó la tarea «Llamar» a Beto')
  })
})

describe('presencia', () => {
  it('quita a uno mismo, lo viejo y deja la señal más reciente por persona', () => {
    const now = 1_000_000
    const list = onlineMembers(
      [
        { userId: 'me', name: 'Yo', initials: 'YO', view: null, editing: false, at: now },
        { userId: 'a', name: 'Ana', initials: 'AN', view: null, editing: false, at: now - 1000 },
        {
          userId: 'a',
          name: 'Ana',
          initials: 'AN',
          view: { entity: 'clients', id: 'c1' },
          editing: true,
          at: now
        },
        {
          userId: 'b',
          name: 'Beto',
          initials: 'BE',
          view: null,
          editing: false,
          at: now - PRESENCE_TTL_MS - 1
        },
        { nada: true }
      ],
      'me',
      now
    )
    expect(list.map((m) => m.userId)).toEqual(['a'])
    expect(list[0]).toMatchObject({ editing: true, view: { entity: 'clients', id: 'c1' } })
  })
})
