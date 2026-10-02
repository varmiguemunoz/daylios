import { EntitySchema } from 'typeorm'
import type { Meeting } from '@shared/consultora'

/** Participantes y action items se guardan como JSON (simple-json) dentro de la reunión. */
export const MeetingModel = new EntitySchema<Meeting>({
  name: 'Meeting',
  tableName: 'meetings',
  columns: {
    id: { type: 'text', primary: true },
    date: { type: 'text' },
    title: { type: 'text' },
    clientId: { name: 'client_id', type: 'text', nullable: true },
    projectId: { name: 'project_id', type: 'text', nullable: true },
    prospectId: { name: 'prospect_id', type: 'text', nullable: true },
    participants: { type: 'simple-json' },
    summaryMd: { name: 'summary_md', type: 'text', default: '' },
    decisionsMd: { name: 'decisions_md', type: 'text', default: '' },
    actionItems: { name: 'action_items', type: 'simple-json' },
    transcriptMd: { name: 'transcript_md', type: 'text', default: '' },
    rawNotesMd: { name: 'raw_notes_md', type: 'text', default: '' },
    recordingPath: { name: 'recording_path', type: 'text', nullable: true },
    durationSec: { name: 'duration_sec', type: 'integer', nullable: true },
    status: { type: 'text' },
    error: { type: 'text', nullable: true },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' }
  },
  indices: [
    { name: 'idx_meetings_date', columns: ['date'] },
    { name: 'idx_meetings_client', columns: ['clientId'] },
    { name: 'idx_meetings_project', columns: ['projectId'] }
  ]
})
