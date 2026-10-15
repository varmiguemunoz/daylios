import { In, type EntityManager } from 'typeorm'
import type { AutomationEvent, Scope, SubjectType } from '@shared/automations'
import type { Contact, Prospect } from '@shared/consultora'
import { ContactModel } from '../models/contact.model'
import { ProspectModel } from '../models/prospect.model'
import { StageModel } from '../models/stage.model'
import { ClientModel } from '../models/client.model'
import { TaskModel } from '../models/task.model'
import { MeetingModel } from '../models/meeting.model'
import { ContactTagModel, TagModel } from '../models/marketing.model'

export interface ScopeSource {
  subjectType: SubjectType
  subjectId: string | null
  event: AutomationEvent
  outputs: Record<string, Record<string, unknown>>
}

const day = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function contactView(
  manager: EntityManager,
  contact: Contact
): Promise<Record<string, unknown>> {
  const links = await manager.getRepository(ContactTagModel).findBy({ contactId: contact.id })
  const tags = links.length
    ? await manager.getRepository(TagModel).findBy({ id: In(links.map((l) => l.tagId)) })
    : []
  const company = contact.fields?.company ?? contact.fields?.empresa ?? null
  return {
    ...contact,
    first_name: (contact.name ?? '').trim().split(/\s+/)[0] ?? '',
    company,
    tags: tags.map((t) => t.slug),
    hasClient: !!contact.clientId
  }
}

async function prospectView(
  manager: EntityManager,
  prospect: Prospect
): Promise<Record<string, unknown>> {
  const stage = await manager.getRepository(StageModel).findOneBy({ id: prospect.stageId })
  return {
    ...prospect,
    value: prospect.valueUsd,
    pipelineId: stage?.pipelineId ?? null,
    stage: stage?.name ?? null,
    open: stage ? stage.kind === 'open' : false
  }
}

export async function loadScope(
  manager: EntityManager,
  source: ScopeSource,
  now: Date
): Promise<Scope> {
  const scope: Scope = {
    now: now.toISOString(),
    today: day(now),
    trigger: source.event.payload,
    steps: source.outputs
  }
  const id = source.subjectId
  if (!id) return scope

  let contact: Contact | null = null
  let prospect: Prospect | null = null
  let clientId: string | null = null

  if (source.subjectType === 'contact') {
    contact = await manager.getRepository(ContactModel).findOneBy({ id })
    if (contact?.prospectId)
      prospect = await manager.getRepository(ProspectModel).findOneBy({ id: contact.prospectId })
    clientId = contact?.clientId ?? prospect?.clientId ?? null
  } else if (source.subjectType === 'prospect') {
    prospect = await manager.getRepository(ProspectModel).findOneBy({ id })
    if (prospect)
      contact = await manager
        .getRepository(ContactModel)
        .findOne({ where: { prospectId: prospect.id }, order: { createdAt: 'ASC' } })
    clientId = prospect?.clientId ?? contact?.clientId ?? null
  } else if (source.subjectType === 'client') {
    clientId = id
  } else if (source.subjectType === 'task') {
    const task = await manager.getRepository(TaskModel).findOneBy({ id })
    if (task) scope.task = task
    clientId = task?.clientId ?? null
  } else if (source.subjectType === 'meeting') {
    const meeting = await manager.getRepository(MeetingModel).findOneBy({ id })
    if (meeting) scope.meeting = meeting
    clientId = meeting?.clientId ?? null
  }

  if (contact) scope.contact = await contactView(manager, contact)
  if (prospect) scope.prospect = await prospectView(manager, prospect)
  if (clientId) {
    const client = await manager.getRepository(ClientModel).findOneBy({ id: clientId })
    if (client) scope.client = client
  }
  return scope
}

export function subjectExists(scope: Scope, subject: SubjectType): boolean {
  if (subject === 'none') return true
  return scope[subject] !== undefined
}
