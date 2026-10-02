/**
 * Dominio de la Consultora (clientes, proyectos, reuniones, pipeline).
 * Compartido entre main, preload, renderer y MCP. Solo tipos, contrato y utilidades puras.
 */

export type ClientStatus = 'activo' | 'historico'
export type ProjectStatus = 'activo' | 'pausa' | 'cerrado'
export type StageKind = 'open' | 'won' | 'lost'
export type MeetingStatus = 'recording' | 'transcribing' | 'summarizing' | 'ready' | 'error'

export const CLIENT_STATUSES: ClientStatus[] = ['activo', 'historico']
export const PROJECT_STATUSES: ProjectStatus[] = ['activo', 'pausa', 'cerrado']
export const STAGE_KINDS: StageKind[] = ['open', 'won', 'lost']

export interface Client {
  id: string
  name: string
  sector: string | null
  status: ClientStatus
  contactsMd: string
  notesMd: string
  /** Fecha de firma YYYY-MM-DD. */
  signedAt: string | null
  /** Carpeta de documentos (absoluta). */
  folderPath: string
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  clientId: string
  name: string
  status: ProjectStatus
  objectiveMd: string
  /** Entregables / épicas como lista de casillas `- [ ]`. */
  deliverablesMd: string
  notesMd: string
  createdAt: string
  updatedAt: string
}

export interface Stage {
  id: string
  name: string
  position: number
  kind: StageKind
}

export interface Prospect {
  id: string
  company: string
  contactMd: string
  valueUsd: number | null
  source: string | null
  stageId: string
  notesMd: string
  nextStep: string | null
  /** YYYY-MM-DD */
  nextStepDate: string | null
  /** Cliente creado al ganar. */
  clientId: string | null
  createdAt: string
  updatedAt: string
}

export interface ActionItem {
  text: string
  owner: string | null
  /** YYYY-MM-DD o texto libre ("viernes"). */
  due: string | null
  done: boolean
}

export interface Meeting {
  id: string
  /** Fecha y hora ISO de inicio. */
  date: string
  title: string
  clientId: string | null
  projectId: string | null
  prospectId: string | null
  participants: string[]
  summaryMd: string
  decisionsMd: string
  actionItems: ActionItem[]
  transcriptMd: string
  rawNotesMd: string
  recordingPath: string | null
  durationSec: number | null
  status: MeetingStatus
  error: string | null
  createdAt: string
  updatedAt: string
}

// ---- Entradas (lo que se puede crear / cambiar) ----

export type ClientInput = Partial<
  Pick<Client, 'name' | 'sector' | 'status' | 'contactsMd' | 'notesMd' | 'signedAt' | 'folderPath'>
>
export type ProjectInput = Partial<
  Pick<Project, 'name' | 'status' | 'objectiveMd' | 'deliverablesMd' | 'notesMd'>
> & { client?: string }
export type ProspectInput = Partial<
  Pick<
    Prospect,
    'company' | 'contactMd' | 'valueUsd' | 'source' | 'notesMd' | 'nextStep' | 'nextStepDate'
  >
> & { stage?: string }
export type MeetingInput = Partial<
  Pick<
    Meeting,
    'date' | 'title' | 'participants' | 'summaryMd' | 'decisionsMd' | 'actionItems' | 'rawNotesMd'
  >
> & {
  /** id o nombre; '' quita la asociación. */
  client?: string
  project?: string
  prospect?: string
}

// ---- Respuestas compuestas ----

/** Reunión sin textos largos, para listas. */
export type MeetingBrief = Pick<
  Meeting,
  'id' | 'date' | 'title' | 'clientId' | 'projectId' | 'prospectId' | 'status' | 'participants'
>

export interface OpenActionItem extends ActionItem {
  meetingId: string
  meetingTitle: string
  meetingDate: string
  /** Posición dentro de la reunión (para marcarlo hecho). */
  index: number
  clientId: string | null
}

export interface DocFile {
  /** Ruta relativa a la carpeta del cliente. */
  path: string
  name: string
  folder: string
  size: number
  modifiedAt: string
}

export interface ClientDetail extends Client {
  projects: (Project & { openDeliverables: string[] })[]
  meetings: MeetingBrief[]
  prospects: Prospect[]
  openActionItems: OpenActionItem[]
  documents: DocFile[]
}

export interface ProjectDetail extends Project {
  client: Pick<Client, 'id' | 'name'>
  openDeliverables: string[]
  meetings: MeetingBrief[]
}

export interface ProspectDetail extends Prospect {
  stage: Stage
  meetings: MeetingBrief[]
}

export interface Pipeline {
  stages: (Stage & { prospects: Prospect[]; valueUsd: number })[]
  openValueUsd: number
}

export interface MeetingsPage {
  days: { date: string; meetings: MeetingBrief[] }[]
  page: number
  totalPages: number
  totalDays: number
}

export interface MeetingFilter {
  client?: string
  project?: string
  prospect?: string
  /** YYYY-MM-DD inclusivo */
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface Overview {
  activeClients: {
    id: string
    name: string
    projects: { id: string; name: string; status: ProjectStatus; openDeliverables: number }[]
    lastMeeting: { id: string; date: string; title: string } | null
  }[]
  openActionItems: OpenActionItem[]
  pipeline: { stage: string; kind: StageKind; count: number; valueUsd: number }[]
  nextSteps: { prospectId: string; company: string; nextStep: string; date: string | null }[]
  recentMeetings: MeetingBrief[]
}

export interface SearchHit {
  type: 'client' | 'project' | 'meeting' | 'prospect'
  id: string
  title: string
  snippet: string
}

/** Listas cortas para selectores (asociar una reunión, etc.). */
export interface Refs {
  clients: { id: string; name: string; status: ClientStatus }[]
  projects: { id: string; name: string; clientId: string; status: ProjectStatus }[]
  prospects: { id: string; company: string; clientId: string | null }[]
}

/** Ajustes visibles en la ventana. La API key nunca sale de main: solo si existe y sus 4 últimos caracteres. */
export interface Settings {
  docsPath: string
  hasApiKey: boolean
  /** "…a1b2" */
  apiKeyHint: string
  transcribeModel: string
  summaryModel: string
  summaryLanguage: string
}

/** Cambios de ajustes. `openaiApiKey: ''` borra la key. */
export interface SettingsInput {
  openaiApiKey?: string
  docsPath?: string
  transcribeModel?: string
  summaryModel?: string
  summaryLanguage?: string
}

export type NoteEntity = 'client' | 'project' | 'prospect' | 'meeting'

export interface StopInfo {
  title: string
  participants: string[]
  clientId: string | null
  projectId: string | null
  prospectId: string | null
  durationSec: number
}

/** Contrato que la ventana Consultora consume (vía IPC). Los mismos servicios sirven la API HTTP. */
export interface ConsultoraApi {
  overview(): Promise<Overview>
  refs(): Promise<Refs>
  search(query: string): Promise<SearchHit[]>
  settings(): Promise<Settings>
  saveSettings(input: SettingsInput): Promise<Settings>
  /** Prueba la API key guardada contra OpenAI. */
  testApiKey(): Promise<{ ok: boolean; message: string }>
  /** Selector de carpeta de macOS. null = cancelado. */
  pickFolder(): Promise<string | null>

  listClients(
    status?: ClientStatus
  ): Promise<(Client & { activeProjects: number; lastMeetingDate: string | null })[]>
  getClient(ref: string): Promise<ClientDetail>
  createClient(input: ClientInput): Promise<Client>
  updateClient(ref: string, patch: ClientInput): Promise<Client>

  getProject(ref: string): Promise<ProjectDetail>
  createProject(input: ProjectInput): Promise<Project>
  updateProject(ref: string, patch: ProjectInput): Promise<Project>

  pipeline(): Promise<Pipeline>
  listStages(): Promise<Stage[]>
  saveStages(stages: (Partial<Stage> & { name: string; kind: StageKind })[]): Promise<Stage[]>
  getProspect(ref: string): Promise<ProspectDetail>
  createProspect(input: ProspectInput): Promise<Prospect>
  updateProspect(ref: string, patch: ProspectInput): Promise<Prospect>
  /** Mueve de etapa. Una etapa `won` crea el cliente (y su carpeta) si aún no existe. */
  moveProspect(ref: string, stage: string): Promise<{ prospect: Prospect; client: Client | null }>

  listMeetings(filter: MeetingFilter): Promise<MeetingsPage>
  getMeeting(id: string): Promise<Meeting>
  createMeeting(input: MeetingInput): Promise<Meeting>
  updateMeeting(id: string, patch: MeetingInput): Promise<Meeting>
  removeMeeting(id: string): Promise<void>
  updateActionItem(id: string, index: number, patch: Partial<ActionItem>): Promise<Meeting>
  /** Transcribe (si falta) y resume. Sirve para reintentar y para resumir notas crudas. */
  processMeeting(id: string): Promise<Meeting>
  /** Propone cliente/proyecto/prospecto según el título. */
  suggestAssociation(title: string): Promise<{
    clientId: string | null
    projectId: string | null
    prospectId: string | null
  }>
  listActionItems(filter: { client?: string; done?: boolean }): Promise<OpenActionItem[]>

  listDocuments(client: string): Promise<DocFile[]>
  readDocument(client: string, path: string): Promise<{ path: string; content: string }>
  appendNote(entity: NoteEntity, ref: string, text: string): Promise<void>
}

// ---- Utilidades ----

/** Minúsculas y sin acentos: para comparar nombres ("Muñoz" = "munoz"). */
export function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Textos de las casillas sin marcar (`- [ ] algo`) de un markdown. */
export function openChecklist(md: string): string[] {
  return [...md.matchAll(/^\s*[-*+]\s+\[ \]\s+(.+)$/gm)].map((m) => m[1].trim())
}

/** Marca o desmarca la casilla de la línea `line` (1-based). Si la línea no es casilla, no cambia nada. */
export function toggleTaskLine(md: string, line: number): string {
  const lines = md.split('\n')
  const current = lines[line - 1]
  if (current === undefined) return md
  lines[line - 1] = current.replace(
    /^(\s*[-*+]\s+\[)([ xX])(\])/,
    (_, a, mark, b) => `${a}${mark === ' ' ? 'x' : ' '}${b}`
  )
  return lines.join('\n')
}
