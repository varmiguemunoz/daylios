import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { DAILY_LIMIT, addDays, type Task } from '@shared/tasks'
import { TaskService } from './task.service'
import { memoryDb } from '../test/helpers'

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
