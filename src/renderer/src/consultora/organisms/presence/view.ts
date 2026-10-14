import type { PresenceView } from '@shared/presence'
import type { Screen } from '../../lib'

const ENTITY: Partial<Record<Screen['name'], string>> = {
  client: 'clients',
  project: 'projects',
  meeting: 'meetings',
  prospect: 'prospects',
  contact: 'contacts'
}

export function viewOf(screen: Screen, workspacePath: string | null): PresenceView | null {
  if (screen.name === 'ws-note' || screen.name === 'ws-board' || screen.name === 'ws-image') {
    return workspacePath ? { entity: 'workspace', id: workspacePath } : null
  }
  if (screen.name === 'document')
    return { entity: 'document', id: `${screen.client}/${screen.path}` }
  const entity = ENTITY[screen.name]
  return entity && 'id' in screen ? { entity, id: screen.id } : null
}
