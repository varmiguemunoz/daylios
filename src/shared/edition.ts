export type Edition = 'local' | 'team'
export const EDITIONS: Edition[] = ['local', 'team']

export type Capability = 'cloud.sync' | 'cloud.files' | 'org.invite' | 'realtime.presence'
export const CAPABILITIES: Capability[] = [
  'cloud.sync',
  'cloud.files',
  'org.invite',
  'realtime.presence'
]

export const EDITION_INFO: Record<Edition, { label: string; includes: string[] }> = {
  local: {
    label: 'Local',
    includes: [
      'Todo vive en este Mac: base SQLite y bóveda de archivos.',
      'Sin cuenta y sin conexiones de nube.',
      'Claude lee tus datos por MCP en este equipo.'
    ]
  },
  team: {
    label: 'Equipo',
    includes: [
      'Cuenta e inicio de sesión.',
      'Organización con invitaciones y roles.',
      'Sincronización entre dispositivos y personas, también sin conexión.',
      'Actividad del equipo en tiempo real.'
    ]
  }
}

export interface EditionStatus {
  edition: Edition
  capabilities: Capability[]
}

export interface EditionApi {
  status(): Promise<EditionStatus>
}

// ---- Qué se sincroniza ----

export const SYNC_TABLES = [
  'clients',
  'projects',
  'meetings',
  'pipelines',
  'pipeline_stages',
  'prospects',
  'prospect_stage_events',
  'contacts',
  'contact_events',
  'contact_tags',
  'tags',
  'lead_sources',
  'rules',
  'newsletters',
  'tasks',
  'note_relations',
  'workspace_items',
  'workspace_refs',
  'dashboards',
  'file_manifest'
] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

export const SOFT_DELETE_TABLES: SyncTable[] = [
  'clients',
  'projects',
  'meetings',
  'pipelines',
  'pipeline_stages',
  'prospects',
  'contacts',
  'tags',
  'lead_sources',
  'rules',
  'tasks',
  'file_manifest'
]

export const SOFT_DELETE_DAYS = 30

export const LOCAL_CHANGE_LOG_LIMIT = 10_000

export const NEVER_SYNC = {
  files: ['settings.json', 'ui-state.json', 'connection.json'],
  tables: [
    'resend_outbox',
    'hub_receipts',
    'change_log',
    'migrations',
    'sync_state',
    'sync_revs',
    'file_state',
    'file_uploads',
    'activity_cache'
  ],
  columns: {
    lead_sources: ['secret'],
    clients: ['folder_path'],
    meetings: ['recording_path']
  } as Partial<Record<SyncTable, string[]>>,

  settings: ['openaiApiKey', 'resendApiKey', 'hubAdminToken'],

  device: ['voice-queue', 'recordings-in-progress', 'session-tokens']
} as const

export const isNeverSynced = (table: string, column?: string): boolean =>
  (NEVER_SYNC.tables as readonly string[]).includes(table) ||
  (!!column && (NEVER_SYNC.columns[table as SyncTable] ?? []).includes(column))

export const FILE_INDEX_TABLES: SyncTable[] = ['workspace_items', 'workspace_refs']

export const isRecordSynced = (table: string): boolean =>
  (SYNC_TABLES as readonly string[]).includes(table) &&
  !(FILE_INDEX_TABLES as string[]).includes(table)
