import type { DataSource } from 'typeorm'
import { ClientService } from './services/client.service'
import { ProjectService } from './services/project.service'
import { ProspectService } from './services/prospect.service'
import { MeetingService } from './services/meeting.service'
import { ContextService } from './services/context.service'
import { AiService } from './services/ai.service'
import { RecordingService } from './services/recording.service'

/** Crea los servicios de la Consultora una sola vez. Los usan IPC (ventana) y Express (Claude). */
export function createConsultora(
  db: DataSource,
  notify: () => void,
  onRecording: (recording: boolean) => void
): Consultora {
  const clients = new ClientService(db)
  const meetings = new MeetingService(db)
  const ai = new AiService()
  return {
    clients,
    projects: new ProjectService(db),
    prospects: new ProspectService(db),
    meetings,
    ai,
    context: new ContextService(db, clients),
    recordings: new RecordingService(db, meetings, ai, notify, onRecording)
  }
}

export interface Consultora {
  clients: ClientService
  projects: ProjectService
  prospects: ProspectService
  meetings: MeetingService
  ai: AiService
  context: ContextService
  recordings: RecordingService
}
