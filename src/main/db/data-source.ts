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

/** Abre `daylios.db` en la carpeta de datos de la app y aplica las migraciones pendientes. */
export async function openDatabase(dir: string): Promise<DataSource> {
  const db = new DataSource({
    type: 'better-sqlite3',
    database: join(dir, 'daylios.db'),
    entities: [
      TaskModel,
      NoteModel,
      ClientModel,
      ProjectModel,
      StageModel,
      ProspectModel,
      MeetingModel,
      ContactModel
    ],
    // En orden. Nunca edites una publicada: añade una nueva al final.
    migrations: [
      CreateTasks1727600000000,
      AddTaskDescription1727800000000,
      CreateNotes1727800000001,
      CreateConsultora1727900000000,
      AddTagsEffortContacts1728000000000
    ],
    migrationsRun: true,
    synchronize: false
  })
  return db.initialize()
}
