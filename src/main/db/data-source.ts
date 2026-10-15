import { mkdirSync } from 'fs'
import { join } from 'path'
import { DataSource } from 'typeorm'
import { TaskModel } from '../models/task.model'
import { ClientModel } from '../models/client.model'
import { ProjectModel } from '../models/project.model'
import { StageModel } from '../models/stage.model'
import { ProspectModel } from '../models/prospect.model'
import { MeetingModel } from '../models/meeting.model'
import { ContactModel } from '../models/contact.model'
import { NoteRelationModel } from '../models/note-relation.model'
import { PipelineModel } from '../models/pipeline.model'
import { WorkspaceItemModel, WorkspaceRefModel } from '../models/workspace.model'
import { CreateTasks1727600000000 } from './migrations/CreateTasks'
import { AddTaskDescription1727800000000 } from './migrations/AddTaskDescription'
import { CreateNotes1727800000001 } from './migrations/CreateNotes'
import { CreateConsultora1727900000000 } from './migrations/CreateConsultora'
import { AddTagsEffortContacts1728000000000 } from './migrations/AddTagsEffortContacts'
import { AddMarketing1728100000000 } from './migrations/AddMarketing'
import { AddSubtasks1728200000000 } from './migrations/AddSubtasks'
import { AddTagAudience1728300000000 } from './migrations/AddTagAudience'
import { AddNoteRelations1728400000000 } from './migrations/AddNoteRelations'
import { AddContactProject1728500000000 } from './migrations/AddContactProject'
import { AddPipelines1728600000000 } from './migrations/AddPipelines'
import { CreateWorkspace1728700000000 } from './migrations/CreateWorkspace'
import { AddTaskStatusAndLinks1728800000000 } from './migrations/AddTaskStatusAndLinks'
import { AddMetrics1728900000000 } from './migrations/AddMetrics'
import { AddSyncMetadata1729000000000 } from './migrations/AddSyncMetadata'
import { installChangeTriggers } from './change-log'
import { registerAuthorFunction } from './author'
import { AddChangeLogAuthor1729100000000 } from './migrations/AddChangeLogAuthor'
import { AddAssignees1729200000000 } from './migrations/AddAssignees'
import { AddSyncTables1729300000000 } from './migrations/AddSyncTables'
import { AddFileManifest1729400000000 } from './migrations/AddFileManifest'
import { AddActivityCache1729500000000 } from './migrations/AddActivityCache'
import { AddAutomations1729600000000 } from './migrations/AddAutomations'
import { MigrateRulesToAutomations1729700000000 } from './migrations/MigrateRulesToAutomations'
import { AUTOMATION_ENTITIES } from '../models/automation.model'
import { DashboardModel, StageEventModel } from '../models/metrics.model'
import {
  ContactEventModel,
  ContactTagModel,
  HubReceiptModel,
  LeadSourceModel,
  NewsletterModel,
  OutboxModel,
  TagModel
} from '../models/marketing.model'

export const ENTITIES = [
  TaskModel,
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
  NewsletterModel,
  OutboxModel,
  HubReceiptModel,
  NoteRelationModel,
  PipelineModel,
  WorkspaceItemModel,
  WorkspaceRefModel,
  StageEventModel,
  DashboardModel,
  ...AUTOMATION_ENTITIES
]

// En orden. Nunca edites una publicada: añade una nueva al final.
export const MIGRATIONS = [
  CreateTasks1727600000000,
  AddTaskDescription1727800000000,
  CreateNotes1727800000001,
  CreateConsultora1727900000000,
  AddTagsEffortContacts1728000000000,
  AddMarketing1728100000000,
  AddSubtasks1728200000000,
  AddTagAudience1728300000000,
  AddNoteRelations1728400000000,
  AddContactProject1728500000000,
  AddPipelines1728600000000,
  CreateWorkspace1728700000000,
  AddTaskStatusAndLinks1728800000000,
  AddMetrics1728900000000,
  AddSyncMetadata1729000000000,
  AddChangeLogAuthor1729100000000,
  AddAssignees1729200000000,
  AddSyncTables1729300000000,
  AddFileManifest1729400000000,
  AddActivityCache1729500000000,
  AddAutomations1729600000000,
  MigrateRulesToAutomations1729700000000
]

export async function openDatabase(dir: string): Promise<DataSource> {
  mkdirSync(dir, { recursive: true })
  return openAt(join(dir, 'daylios.db'))
}

export async function openAt(database: string): Promise<DataSource> {
  const db = new DataSource({
    type: 'better-sqlite3',
    database,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsRun: false,
    synchronize: false
  })
  await db.initialize()
  registerAuthorFunction(db)
  await db.runMigrations({ transaction: 'all' })
  await installChangeTriggers(db)
  return db
}
