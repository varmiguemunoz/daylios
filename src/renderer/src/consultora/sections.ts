import {
  Briefcase,
  House,
  CalendarClock,
  Library,
  ListChecks,
  Newspaper,
  SquareKanban,
  Tags as TagsIcon,
  Users,
  Waypoints,
  Send,
  Workflow,
  type LucideIcon
} from 'lucide-react'
import type { Screen } from './lib'

export type Section =
  | 'home'
  | 'workspace'
  | 'tasks'
  | 'clients'
  | 'contacts'
  | 'meetings'
  | 'pipeline'
  | 'tags'
  | 'automations'
  | 'sources'
  | 'outreach'
  | 'newsletters'
  | 'settings'

export interface SectionLink {
  id: Section
  label: string
  icon: LucideIcon
}

export const SECTIONS: SectionLink[] = [
  { id: 'home', label: 'Inicio', icon: House },
  { id: 'workspace', label: 'Workspace', icon: Library },
  { id: 'tasks', label: 'Tareas', icon: ListChecks },
  { id: 'clients', label: 'Clientes', icon: Briefcase },
  { id: 'contacts', label: 'Contactos', icon: Users },
  { id: 'meetings', label: 'Reuniones', icon: CalendarClock },
  { id: 'pipeline', label: 'Pipeline', icon: SquareKanban },
  { id: 'tags', label: 'Tags', icon: TagsIcon },
  { id: 'automations', label: 'Automatizaciones', icon: Workflow }
]

export const EMAIL_SECTIONS: SectionLink[] = [
  { id: 'sources', label: 'Fuentes', icon: Waypoints },
  { id: 'outreach', label: 'Outreach', icon: Send },
  { id: 'newsletters', label: 'Newsletters', icon: Newspaper }
]

export const rootOf = (id: Section): Screen =>
  id === 'workspace' ? { name: 'workspace', folder: null } : { name: id }

export const isWorkspaceScreen = (s: Screen): boolean =>
  s.name === 'workspace' || s.name === 'ws-note' || s.name === 'ws-board' || s.name === 'ws-image'
