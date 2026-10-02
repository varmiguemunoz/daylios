import { join } from 'path'
import { DataSource } from 'typeorm'
import { TaskModel } from '../models/task.model'
import { NoteModel } from '../models/note.model'
import { ClientModel } from '../models/client.model'
import { ProjectModel } from '../models/project.model'
import { StageModel } from '../models/stage.model'
import { ProspectModel } from '../models/prospect.model'
import { MeetingModel } from '../models/meeting.model'
import { ContactModel } from '../models/contact.model'
import { CreateTasks1727600000000 } from './migrations/CreateTasks'
import { AddTaskDescription1727800000000 } from './migrations/AddTaskDescription'
import { CreateNotes1727800000001 } from './migrations/CreateNotes'
import { CreateConsultora1727900000000 } from './migrations/CreateConsultora'
import { AddTagsEffortContacts1728000000000 } from './migrations/AddTagsEffortContacts'
import { AddMarketing1728100000000 } from './migrations/AddMarketing'
import {
  ContactEventModel,
  ContactTagModel,
  HubReceiptModel,
  LeadSourceModel,
  NewsletterModel,
  OutboxModel,
  RuleModel,
  TagModel
} from '../models/marketing.model'

export const ENTITIES = [
  TaskModel,
  NoteModel,
  ClientModel,
  ProjectModel,
  StageModel,
  ProspectModel,
  MeetingModel,
  ContactModel,
  TagModel,
  ContactTagModel,
  ContactEventModel,
  LeadSourceModel,
  RuleModel,
  NewsletterModel,
  OutboxModel,
  HubReceiptModel
]

// En orden. Nunca edites una publicada: añade una nueva al final.
export const MIGRATIONS = [
  CreateTasks1727600000000,
  AddTaskDescription1727800000000,
  CreateNotes1727800000001,
  CreateConsultora1727900000000,
  AddTagsEffortContacts1728000000000,
  AddMarketing1728100000000
]

/** Abre `daylios.db` en la carpeta de datos de la app y aplica las migraciones pendientes. */
export async function openDatabase(dir: string): Promise<DataSource> {
  return openAt(join(dir, 'daylios.db'))
}

/** Abre una base en `database` (ruta o `:memory:` en tests) con todas las migraciones aplicadas. */
export function openAt(database: string): Promise<DataSource> {
  const db = new DataSource({
    type: 'better-sqlite3',
    database,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsRun: true,
    synchronize: false
  })
  return db.initialize()
}
