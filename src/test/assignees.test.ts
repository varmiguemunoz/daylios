import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { isolatedConfig, memoryDb } from '../main/test/helpers'
import { TaskService } from '../main/services/task.service'
import { ProspectService } from '../main/services/prospect.service'

const ANA = '8f14e45f-ceea-4e7a-9c3f-2b1d8a6f0c11'
const LUIS = '45c48cce-2e2d-4fbd-8a1c-7c1f6e1f9a22'

describe('responsable', () => {
  let db: DataSource
  let tasks: TaskService

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
    tasks = new TaskService(db)
  })
  afterEach(() => db.destroy())

  it('una tarea se asigna, se reasigna y se quita', async () => {
    const t = await tasks.add('2026-10-14', 'Propuesta')
    expect((await tasks.update(t.id, { assignee: ANA })).assigneeId).toBe(ANA)
    expect((await tasks.update(t.id, { assignee: LUIS })).assigneeId).toBe(LUIS)
    expect((await tasks.update(t.id, { assignee: '' })).assigneeId).toBeNull()
  })

  it('rechaza un responsable que no es un id de usuario', async () => {
    const t = await tasks.add('2026-10-14', 'Propuesta')
    await expect(tasks.update(t.id, { assignee: 'ana' })).rejects.toThrow(/responsable/)
  })

  it('«Mis tareas» filtra el tablero por responsable', async () => {
    const mine = await tasks.add('2026-10-14', 'Mía')
    await tasks.add('2026-10-14', 'De nadie')
    await tasks.update(mine.id, { assignee: ANA })
    const board = await tasks.board({ assignee: ANA })
    expect(board.map((t) => t.title)).toEqual(['Mía'])
  })

  it('los prospectos guardan su responsable', async () => {
    const prospects = new ProspectService(db)
    const p = await prospects.create({ company: 'Acme', assigneeId: ANA })
    expect(p.assigneeId).toBe(ANA)
    expect((await prospects.update(p.id, { assigneeId: null })).assigneeId).toBeNull()
  })
})
