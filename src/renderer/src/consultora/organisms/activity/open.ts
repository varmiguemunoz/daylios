import type { ActivityEntity } from '@shared/activity'
import type { Screen } from '../../lib'
import { activityApi } from './useActivity'

const WORKSPACE = 'Workspace/'

const KIND_SCREEN = { note: 'ws-note', board: 'ws-board', image: 'ws-image' } as const

export async function screensFor(entity: string, id: string): Promise<Screen[] | null> {
  switch (entity as ActivityEntity) {
    case 'clients':
      return [{ name: 'clients' }, { name: 'client', id }]
    case 'projects':
      return [{ name: 'clients' }, { name: 'project', id }]
    case 'meetings':
      return [{ name: 'meetings' }, { name: 'meeting', id }]
    case 'prospects':
      return [{ name: 'pipeline' }, { name: 'prospect', id }]
    case 'contacts':
      return [{ name: 'contacts' }, { name: 'contact', id }]
    case 'tasks':
      return [{ name: 'tasks', task: id }]
    case 'pipelines':
      return [{ name: 'pipeline' }]
    case 'members':
      return [{ name: 'settings' }]
    case 'file_manifest': {
      const path = await activityApi.filePath(id).catch(() => null)
      if (!path?.startsWith(WORKSPACE)) return null
      const item = await window.api.workspace
        .resolve(path.slice(WORKSPACE.length))
        .catch(() => null)
      if (!item) return null
      if (item.kind === 'folder') return [{ name: 'workspace', folder: item.id }]
      if (item.kind === 'file') return [{ name: 'workspace', folder: item.parentId }]
      return [{ name: KIND_SCREEN[item.kind], id: item.id }]
    }
    default:
      return null
  }
}
