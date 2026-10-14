import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { DAILY_LIMIT, addDays, type Task } from '@shared/tasks'
import { TaskService } from '../main/services/task.service'
import { isolatedConfig, memoryDb } from '../main/test/helpers'
import { ClientService } from '../main/services/client.service'
import { ProjectService } from '../main/services/project.service'

describe('TaskService · subtareas', () => {
  let db: DataSource
  let tasks: TaskService
  const day = '2026-10-13'

  beforeEach(async () => {
    db = await memoryDb()
    tasks = new TaskService(db)
  })
  afterEach(() => db.destroy())

  it('las subtareas no cuentan para el techo', async () => {
    const parents: Task[] = []
    for (let i = 0; i < DAILY_LIMIT; i++) parents.push(await tasks.add(day, `Tarea ${i}`))
    for (let i = 0; i < 10; i++) await tasks.addSubtask(parents[0].id, `Sub ${i}`)
    const list = await tasks.getDay(day)
    expect(list).toHaveLength(DAILY_LIMIT)
    expect(list[0].subtasks).toEqual({ total: 10, done: 0 })
  })

  it('una subtarea no puede tener subtareas', async () => {
    const parent = await tasks.add(day, 'Madre')
    const sub = await tasks.addSubtask(parent.id, 'Hija')
    await expect(tasks.addSubtask(sub.id, 'Nieta')).rejects.toThrow()
  })

  it('mover la madre mueve sus subtareas; la subtarea sola no se mueve', async () => {
    const parent = await tasks.add(day, 'Madre')
    const sub = await tasks.addSubtask(parent.id, 'Hija')
    const tomorrow = addDays(day, 1)
    await tasks.moveToDate(parent.id, tomorrow)
    expect((await tasks.get(sub.id)).task.date).toBe(tomorrow)
    await expect(tasks.moveToDate(sub.id, day)).rejects.toThrow()
  })

  it('borrar la madre y restaurar devuelve madre y subtareas en su orden', async () => {
    const parent = await tasks.add(day, 'Madre')
    await tasks.addSubtask(parent.id, 'Uno')
    await tasks.addSubtask(parent.id, 'Dos')
    const removed = await tasks.remove(parent.id)
    expect(removed.subtasks).toHaveLength(2)
    expect(await tasks.getDay(day)).toHaveLength(0)
    await tasks.restore(removed)
    const view = await tasks.get(parent.id)
    expect(view.subtasks.map((t) => t.title)).toEqual(['Uno', 'Dos'])
  })
})

describe('TaskService · estado y relaciones (tablero)', () => {
  let db: DataSource
  let tasks: TaskService
  const day = '2026-10-13'

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
    tasks = new TaskService(db)
  })
  afterEach(() => db.destroy())

  it('una tarea nueva está Pendiente', async () => {
    const t = await tasks.add(day, 'Propuesta')
    expect(t.status).toBe('todo')
    expect(t.done).toBe(false)
  })

  it('Hecha completa la tarea y salir de Hecha la reabre', async () => {
    const t = await tasks.add(day, 'Propuesta')
    const doing = await tasks.setStatus(t.id, 'doing')
    expect(doing).toMatchObject({ status: 'doing', done: false, completedAt: null })
    const done = await tasks.setStatus(t.id, 'done')
    expect(done.done).toBe(true)
    expect(done.completedAt).not.toBeNull()
    const back = await tasks.setStatus(t.id, 'doing')
    expect(back).toMatchObject({ done: false, completedAt: null })
  })

  it('marcar done desde el menubar mueve el estado igual', async () => {
    const t = await tasks.add(day, 'Propuesta')
    await tasks.setStatus(t.id, 'doing')
    expect((await tasks.update(t.id, { done: true })).status).toBe('done')
    expect((await tasks.update(t.id, { done: false })).status).toBe('todo')
  })

  it('completar subtareas las deja en Hecha', async () => {
    const parent = await tasks.add(day, 'Madre')
    await tasks.addSubtask(parent.id, 'Uno')
    const subs = await tasks.completeSubtasks(parent.id)
    expect(subs.every((s) => s.status === 'done' && s.done)).toBe(true)
  })

  it('el tablero filtra por fechas, abiertas, texto y tags', async () => {
    const a = await tasks.add(day, 'Llamar a Acme #ventas')
    const b = await tasks.add(addDays(day, 1), 'Factura TKP')
    await tasks.add(addDays(day, -1), 'Vieja')
    await tasks.setStatus(b.id, 'done')
    expect((await tasks.board({ from: day, to: addDays(day, 1) })).map((t) => t.id)).toEqual([
      a.id,
      b.id
    ])
    expect(
      (await tasks.board({ from: day, to: addDays(day, 1), onlyOpen: true })).map((t) => t.id)
    ).toEqual([a.id])
    expect((await tasks.board({ query: 'acme' })).map((t) => t.id)).toEqual([a.id])
    expect((await tasks.board({ tags: ['ventas'] })).map((t) => t.id)).toEqual([a.id])
  })

  it('relacionar con un proyecto fija su cliente y borrar el cliente lo quita', async () => {
    const clients = new ClientService(db)
    const client = await clients.create({ name: 'Acme' })
    const project = await new ProjectService(db).create({ client: client.id, name: 'Web' })
    const t = await tasks.add(day, 'Diseño')
    const linked = await tasks.update(t.id, { project: project.id })
    expect(linked).toMatchObject({ clientId: client.id, projectId: project.id })
    const [card] = await tasks.board({ client: client.id })
    expect(card.links).toEqual({
      client: { id: client.id, name: 'Acme' },
      project: { id: project.id, name: 'Web' }
    })
    expect((await tasks.forRecord('client', client.id)).map((x) => x.id)).toEqual([t.id])
    await clients.remove(client.id)
    expect((await tasks.get(t.id)).task).toMatchObject({ clientId: null, projectId: null })
  })

  it('una subtarea no lleva relaciones', async () => {
    const parent = await tasks.add(day, 'Madre')
    const sub = await tasks.addSubtask(parent.id, 'Hija')
    await expect(tasks.update(sub.id, { client: 'x' })).rejects.toThrow()
  })
})
