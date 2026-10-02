/**
 * Dominio de la Consultora (clientes, proyectos, reuniones, pipeline).
 * Compartido entre main, preload, renderer y MCP. Solo tipos, contrato y utilidades puras.
 */

import type { ContactEvent, ContactFields, ContactStatus, TagRef } from './marketing'

export type ClientStatus = 'activo' | 'historico'
export type ProjectStatus = 'activo' | 'pausa' | 'cerrado'
export type StageKind = 'open' | 'won' | 'lost'
/** Idiomas de transcripción disponibles. */
export type Language = 'es' | 'en'
export const LANGUAGES: Language[] = ['es', 'en']

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
  /** Orden dentro de su etapa. */
  position: number
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
  /** Idioma hablado (para la transcripción). */
  language: Language | null
  status: MeetingStatus
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface Contact {
  id: string
  /** Opcional: un lead puede llegar solo con email. La UI muestra `contactLabel()`. */
  name: string | null
  role: string | null
  /** Minúsculas; único entre los contactos que lo tienen. */
  email: string | null
  phone: string | null
  linkedin: string | null
  notesMd: string
  clientId: string | null
  prospectId: string | null
  /** Suscripción a emails de marketing (`none` = contacto de trabajo). */
  status: ContactStatus
  /** Slug de la fuente por la que entró, o `manual`. */
  source: string | null
  fields: ContactFields
  /** Momento del opt-in (prueba de consentimiento). */
  consentAt: string | null
  syncError: string | null
  syncedAt: string | null
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
export type ContactInput = Partial<
  Pick<Contact, 'name' | 'role' | 'email' | 'phone' | 'linkedin' | 'notesMd' | 'fields'>
> & {
  /** id o nombre; '' quita la relación. */
  client?: string
  prospect?: string
}

export type MeetingInput = Partial<
  Pick<
    Meeting,
    | 'date'
    | 'title'
    | 'participants'
    | 'summaryMd'
    | 'decisionsMd'
    | 'actionItems'
    | 'rawNotesMd'
    | 'language'
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

/** Contacto con el nombre de su cliente o prospecto y sus tags (para listas). */
export interface ContactBrief extends Contact {
  organization: string | null
  tags: TagRef[]
}

export interface ContactDetail extends ContactBrief {
  /** Reuniones donde aparece como participante (por nombre). */
  meetings: MeetingBrief[]
  /** Línea de tiempo, más reciente primero (máx. 100). */
  events: ContactEvent[]
}

export interface ContactFilter {
  client?: string
  prospect?: string
  /** Nombre, rol, email o empresa. */
  query?: string
  /** Slug del tag. */
  tag?: string
  status?: ContactStatus
  /** Slug de la fuente. */
  source?: string
  page?: number
  pageSize?: number
}

export interface ContactsPage {
  contacts: ContactBrief[]
  page: number
  totalPages: number
  total: number
}

export interface ClientDetail extends Client {
  contacts: Contact[]
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
  contacts: Contact[]
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
  type: 'client' | 'project' | 'meeting' | 'prospect' | 'contact'
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
  /** Atajo global de nota de voz (formato Electron, p. ej. "Alt+Space"). */
  voiceShortcut: string
  voiceEnabled: boolean
  // ---- Email marketing (los secretos, solo como pista) ----
  hasResendKey: boolean
  resendKeyHint: string
  fromEmail: string
  fromName: string
  replyTo: string
  ownerEmail: string
  hubUrl: string
  hasHubToken: boolean
  hubTokenHint: string
  newsletterPaused: boolean
}

/** Estado del atajo de nota de voz. */
export interface VoiceStatus {
  shortcut: string
  enabled: boolean
  /** false = otra app ya usa ese atajo. */
  registered: boolean
  /** hold = mantener pulsado; toggle = pulsar para empezar y otra vez para terminar. */
  mode: 'hold' | 'toggle'
  /** Permiso de Accesibilidad (necesario para «mantener pulsado»). */
  accessibility: boolean
  /** Audios cuya transcripción falló, esperando «Reintentar». */
  pending: number
}

/** Cambios de ajustes. `openaiApiKey: ''` borra la key. */
export interface SettingsInput {
  openaiApiKey?: string
  docsPath?: string
  transcribeModel?: string
  summaryModel?: string
  summaryLanguage?: string
  voiceShortcut?: string
  voiceEnabled?: boolean
  /** '' borra la key. */
  resendApiKey?: string
  fromEmail?: string
  fromName?: string
  replyTo?: string
  ownerEmail?: string
  hubUrl?: string
  /** '' borra el token. */
  hubAdminToken?: string
  newsletterPaused?: boolean
}

export type NoteEntity = 'client' | 'project' | 'prospect' | 'meeting'

export interface StopInfo {
  title: string
  participants: string[]
  clientId: string | null
  projectId: string | null
  prospectId: string | null
  durationSec: number
  language: Language
}

/** Datos al subir una grabación existente (video o audio). */
export interface ImportInfo {
  title: string
  participants: string[]
  clientId: string | null
  projectId: string | null
  prospectId: string | null
  language: Language
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
  voiceStatus(): Promise<VoiceStatus>
  /** Vuelve a procesar los audios de notas de voz que fallaron. */
  retryVoiceNotes(): Promise<{ created: number; failed: number }>
  /** Vuelve a registrar el atajo (tras dar el permiso de Accesibilidad). */
  refreshVoice(): Promise<VoiceStatus>

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
  /**
   * Mueve de etapa (y opcionalmente a la posición `index` dentro de ella).
   * Una etapa `won` crea el cliente (y su carpeta) si aún no existe.
   */
  moveProspect(
    ref: string,
    stage: string,
    index?: number
  ): Promise<{ prospect: Prospect; client: Client | null }>

  listContacts(filter: ContactFilter): Promise<ContactsPage>
  getContact(id: string): Promise<ContactDetail>
  createContact(input: ContactInput): Promise<Contact>
  updateContact(id: string, patch: ContactInput): Promise<Contact>
  removeContact(id: string): Promise<void>
  /** Suscribe a marketing (exige email; guarda el consentimiento con fuente `manual`). */
  subscribeContact(id: string): Promise<Contact>
  unsubscribeContact(id: string): Promise<Contact>
  /** Añade y/o quita tags (por nombre o slug). Los tags añadidos disparan sus reglas. */
  tagContact(id: string, change: { add?: string[]; remove?: string[] }): Promise<ContactBrief>
  /** Crea un prospecto con este contacto en la etapa dada (vacío = primera abierta). */
  promoteContact(id: string, stage?: string): Promise<{ contact: Contact; prospect: Prospect }>

  /** Selector de archivo de macOS para subir una grabación. null = cancelado. */
  pickRecording(): Promise<string | null>
  /** Copia la grabación a la carpeta de documentos, crea la reunión y lanza transcripción + resumen. */
  importRecording(path: string, info: ImportInfo): Promise<Meeting>

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
