import type { Handlers } from '../ports'
import { communicationHandlers, type NoteWriter } from './communication'
import { CONTACT_HANDLERS } from './contact'
import { CONTROL_HANDLERS } from './control'
import { PIPELINE_HANDLERS } from './pipeline'

export function createHandlers(notes: NoteWriter): Handlers {
  return {
    ...CONTROL_HANDLERS,
    ...CONTACT_HANDLERS,
    ...PIPELINE_HANDLERS,
    ...communicationHandlers(notes)
  }
}
