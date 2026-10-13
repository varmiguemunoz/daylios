import {
  Briefcase,
  CalendarClock,
  Library,
  MailPlus,
  Newspaper,
  SquareKanban,
  Tags as TagsIcon,
  Users,
  Waypoints,
  Workflow,
  type LucideIcon
} from 'lucide-react'
import type { Screen } from './lib'

export type Section =
  | 'workspace'
  | 'clients'
  | 'contacts'
  | 'meetings'
  | 'pipeline'
  | 'tags'
  | 'sources'
  | 'rules'
  | 'sequences'
  | 'newsletters'
  | 'settings'

export interface SectionLink {
  id: Section
  label: string
  icon: LucideIcon
}

export const SECTIONS: SectionLink[] = [
  { id: 'workspace', label: 'Workspace', icon: Library },
  { id: 'clients', label: 'Clientes', icon: Briefcase },
  { id: 'contacts', label: 'Contactos', icon: Users },
  { id: 'meetings', label: 'Reuniones', icon: CalendarClock },
  { id: 'pipeline', label: 'Pipeline', icon: SquareKanban },
  { id: 'tags', label: 'Tags', icon: TagsIcon }
]

/** Email marketing: de dónde entran los leads y qué se les envía. */
export const EMAIL_SECTIONS: SectionLink[] = [
  { id: 'sources', label: 'Fuentes', icon: Waypoints },
  { id: 'rules', label: 'Reglas', icon: Workflow },
  { id: 'sequences', label: 'Secuencias', icon: MailPlus },
  { id: 'newsletters', label: 'Newsletters', icon: Newspaper }
]

/** Pantalla inicial de cada sección (el workspace empieza en su inicio). */
export const rootOf = (id: Section): Screen =>
  id === 'workspace' ? { name: 'workspace', folder: null } : { name: id }

/** Pantallas del workspace: se muestran sin barra lateral ni cabecera de Consultora. */
export const isWorkspaceScreen = (s: Screen): boolean =>
  s.name === 'workspace' || s.name === 'ws-note' || s.name === 'ws-board' || s.name === 'ws-image'
