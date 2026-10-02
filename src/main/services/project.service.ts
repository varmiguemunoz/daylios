import { randomUUID } from 'crypto'
import type { DataSource } from 'typeorm'
import {
  PROJECT_STATUSES,
  openChecklist,
  type Project,
  type ProjectDetail,
  type ProjectInput
} from '@shared/consultora'
import { ClientModel } from '../models/client.model'
import { ProjectModel } from '../models/project.model'
import { MeetingModel } from '../models/meeting.model'
import { transactionGuard } from '../guards/transaction.guard'
import { findByRef } from './ref'
import { markdown, now, oneOf, requiredText } from './fields'
import { brief } from './meeting.helpers'

/** Proyectos de un cliente: objetivo, entregables (casillas) y notas. */
export class ProjectService {
  constructor(private readonly db: DataSource) {}

  find(ref: unknown): Promise<Project> {
    return findByRef(this.db.getRepository(ProjectModel), ref, 'name', 'el proyecto')
  }

  /** Proyecto + cliente + entregables pendientes + reuniones del proyecto. */
  async get(ref: unknown): Promise<ProjectDetail> {
    const project = await this.find(ref)
    const client = await this.db
      .getRepository(ClientModel)
      .findOneByOrFail({ id: project.clientId })
    const meetings = await this.db
      .getRepository(MeetingModel)
      .find({ where: { projectId: project.id }, order: { date: 'DESC' } })
    return {
      ...project,
      client: { id: client.id, name: client.name },
      openDeliverables: openChecklist(project.deliverablesMd),
      meetings: meetings.map(brief)
    }
  }

  create(input: ProjectInput): Promise<Project> {
    return transactionGuard(this.db, async (manager) => {
      const client = await findByRef(
        manager.getRepository(ClientModel),
        input.client,
        'name',
        'el cliente'
      )
      const stamp = now()
      const project: Project = {
        id: randomUUID(),
        clientId: client.id,
        name: requiredText(input.name, 'El nombre del proyecto'),
        status: input.status ? oneOf(input.status, PROJECT_STATUSES, 'El estado') : 'activo',
        objectiveMd: markdown(input.objectiveMd, 'El objetivo'),
        deliverablesMd: markdown(input.deliverablesMd, 'Los entregables'),
        notesMd: markdown(input.notesMd, 'Las notas'),
        createdAt: stamp,
        updatedAt: stamp
      }
      await manager.getRepository(ProjectModel).insert(project)
      return project
    })
  }

  update(ref: unknown, patch: ProjectInput): Promise<Project> {
    return transactionGuard(this.db, async (manager) => {
      const projects = manager.getRepository(ProjectModel)
      const project = await findByRef(projects, ref, 'name', 'el proyecto')
      if (patch.name !== undefined)
        project.name = requiredText(patch.name, 'El nombre del proyecto')
      if (patch.status !== undefined)
        project.status = oneOf(patch.status, PROJECT_STATUSES, 'El estado')
      if (patch.objectiveMd !== undefined)
        project.objectiveMd = markdown(patch.objectiveMd, 'El objetivo')
      if (patch.deliverablesMd !== undefined) {
        project.deliverablesMd = markdown(patch.deliverablesMd, 'Los entregables')
      }
      if (patch.notesMd !== undefined) project.notesMd = markdown(patch.notesMd, 'Las notas')
      if (patch.client !== undefined) {
        const client = await findByRef(
          manager.getRepository(ClientModel),
          patch.client,
          'name',
          'el cliente'
        )
        project.clientId = client.id
      }
      project.updatedAt = now()
      return projects.save(project)
    })
  }
}
