import type { ContactEvent, ContactFields, ContactStatus, TagRef } from './marketing'
import type { ClientNote } from './notes'

export type ClientStatus = 'activo' | 'historico'
export type ProjectStatus = 'activo' | 'pausa' | 'cerrado'
export type StageKind = 'open' | 'won' | 'lost'

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

  signedAt: string | null

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

  deliverablesMd: string
  notesMd: string
  assigneeId: string | null
  createdAt: string
  updatedAt: string
}

export interface Stage {
  id: string
  name: string
  position: number
  kind: StageKind

  pipelineId: string
}

export interface PipelineRef {
  id: string
  name: string
  position: number
}

export interface PipelineSummary extends PipelineRef {
  stages: number
  prospects: number
  openValueUsd: number
}

export type StageInput = Partial<Stage> & { name: string; kind: StageKind }

export interface PipelineInput {
  id?: string
  name: string

  stages?: StageInput[]

  moves?: { from: string; to: string }[]
}

export interface Prospect {
  id: string
  company: string
  contactMd: string
  valueUsd: number | null
  source: string | null
  stageId: string

  position: number
  notesMd: string
  nextStep: string | null

  nextStepDate: string | null

  clientId: string | null

  closedAt: string | null
  assigneeId: string | null
  createdAt: string
  updatedAt: string
}

export interface ActionItem {
  text: string
  owner: string | null

  due: string | null
  done: boolean
}

export interface Meeting {
  id: string

  date: string
  title: string
  clientId: string | null
  projectId: string | null
  prospectId: string | null
  assigneeId: string | null
  participants: string[]
  summaryMd: string
  decisionsMd: string
  actionItems: ActionItem[]
  transcriptMd: string
  rawNotesMd: string
  recordingPath: string | null
  durationSec: number | null

  language: Language | null
  status: MeetingStatus
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface Contact {
  id: string

  name: string | null
  role: string | null

  email: string | null
  phone: string | null
  linkedin: string | null
  notesMd: string
  clientId: string | null

  projectId: string | null
  prospectId: string | null

  status: ContactStatus

  source: string | null
  fields: ContactFields

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
  Pick<Project, 'name' | 'status' | 'objectiveMd' | 'deliverablesMd' | 'notesMd' | 'assigneeId'>
> & { client?: string }
export type ProspectInput = Partial<
  Pick<
    Prospect,
    | 'company'
    | 'contactMd'
    | 'valueUsd'
    | 'source'
    | 'notesMd'
    | 'nextStep'
    | 'nextStepDate'
    | 'assigneeId'
  >
> & {
  stage?: string

  pipeline?: string
}
export type ContactInput = Partial<
  Pick<Contact, 'name' | 'role' | 'email' | 'phone' | 'linkedin' | 'notesMd' | 'fields'>
> & {
  client?: string

  project?: string
  prospect?: string
}

export interface ConvertInput {
  pipeline?: string

  stage?: string

  company?: string
  valueUsd?: number | null
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
    | 'assigneeId'
  >
> & {
  client?: string
  project?: string
  prospect?: string
}

// ---- Respuestas compuestas ----

export type MeetingBrief = Pick<
  Meeting,
  'id' | 'date' | 'title' | 'clientId' | 'projectId' | 'prospectId' | 'status' | 'participants'
>

export interface OpenActionItem extends ActionItem {
  meetingId: string
  meetingTitle: string
  meetingDate: string

  index: number
  clientId: string | null
}

export interface DocFile {
  path: string
  name: string
  folder: string
  size: number
  modifiedAt: string
}

export interface ContactBrief extends Contact {
  organization: string | null
  tags: TagRef[]
}

export interface ContactDetail extends ContactBrief {
  project: { id: string; name: string } | null

  prospect: {
    id: string
    company: string
    stage: string
    stageKind: StageKind
    pipeline: string
  } | null

  meetings: MeetingBrief[]

  events: ContactEvent[]
}

export interface ContactFilter {
  client?: string
  prospect?: string

  tags?: string[]

  inPipeline?: boolean

  query?: string

  tag?: string
  status?: ContactStatus

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

  notes: ClientNote[]

  folder: string | null
}

export interface ClientImpact {
  projects: number
  meetings: number
  contacts: number
  prospects: number
  notes: number
  folderPath: string
}

export interface DocContent {
  path: string
  name: string
  content: string
  modifiedAt: string
}

export interface ProjectDetail extends Project {
  client: Pick<Client, 'id' | 'name'>
  openDeliverables: string[]
  meetings: MeetingBrief[]
}

export interface ProspectDetail extends Prospect {
  contacts: Contact[]
  stage: Stage
  pipeline: PipelineRef
  meetings: MeetingBrief[]
}

export interface ProspectCard extends Prospect {
  contact: { id: string; name: string } | null
  tags: TagRef[]
}

export interface Pipeline {
  pipeline: PipelineRef
  stages: (Stage & { prospects: ProspectCard[]; valueUsd: number })[]
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
  pipeline: { pipeline: string; stage: string; kind: StageKind; count: number; valueUsd: number }[]
  nextSteps: { prospectId: string; company: string; nextStep: string; date: string | null }[]
  recentMeetings: MeetingBrief[]
}

export interface SearchHit {
  type: 'client' | 'project' | 'meeting' | 'prospect' | 'contact'
  id: string
  title: string
  snippet: string
}

export interface Refs {
  clients: { id: string; name: string; status: ClientStatus }[]
  projects: { id: string; name: string; clientId: string; status: ProjectStatus }[]
  prospects: { id: string; company: string; clientId: string | null }[]
}

export interface Settings {
  docsPath: string

  workspacePath: string
  hasApiKey: boolean

  apiKeyHint: string
  transcribeModel: string
  summaryModel: string
  summaryLanguage: string

  voiceShortcut: string
  voiceEnabled: boolean

  workspaceShortcut: string
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

export interface VoiceStatus {
  shortcut: string
  enabled: boolean

  registered: boolean

  mode: 'hold' | 'toggle'

  accessibility: boolean

  pending: number
}

export interface SettingsInput {
  openaiApiKey?: string
  docsPath?: string

  workspacePath?: string
  transcribeModel?: string
  summaryModel?: string
  summaryLanguage?: string
  voiceShortcut?: string

  workspaceShortcut?: string
  voiceEnabled?: boolean

  resendApiKey?: string
  fromEmail?: string
  fromName?: string
  replyTo?: string
  ownerEmail?: string
  hubUrl?: string

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

export interface ImportInfo {
  title: string
  participants: string[]
  clientId: string | null
  projectId: string | null
  prospectId: string | null
  language: Language
}

export interface ConsultoraApi {
  overview(): Promise<Overview>
  refs(): Promise<Refs>
  search(query: string): Promise<SearchHit[]>
  settings(): Promise<Settings>
  saveSettings(input: SettingsInput): Promise<Settings>

  testApiKey(): Promise<{ ok: boolean; message: string }>

  pickFolder(): Promise<string | null>
  voiceStatus(): Promise<VoiceStatus>

  retryVoiceNotes(): Promise<{ created: number; failed: number }>

  refreshVoice(): Promise<VoiceStatus>

  workspaceShortcutStatus(): Promise<{ shortcut: string; registered: boolean }>

  listClients(
    status?: ClientStatus
  ): Promise<(Client & { activeProjects: number; lastMeetingDate: string | null })[]>
  getClient(ref: string): Promise<ClientDetail>
  createClient(input: ClientInput): Promise<Client>
  updateClient(ref: string, patch: ClientInput): Promise<Client>
  clientImpact(ref: string): Promise<ClientImpact>

  removeClient(ref: string, opts: { trashFolder: boolean }): Promise<void>

  getProject(ref: string): Promise<ProjectDetail>
  createProject(input: ProjectInput): Promise<Project>
  updateProject(ref: string, patch: ProjectInput): Promise<Project>

  removeProject(ref: string): Promise<void>

  listPipelines(): Promise<PipelineSummary[]>

  pipeline(ref?: string): Promise<Pipeline>

  savePipeline(input: PipelineInput): Promise<Pipeline>

  removePipeline(ref: string, moveTo?: { pipeline: string; stage?: string }): Promise<void>

  listStages(pipeline?: string): Promise<Stage[]>

  saveStages(stages: StageInput[]): Promise<Stage[]>
  getProspect(ref: string): Promise<ProspectDetail>
  createProspect(input: ProspectInput): Promise<Prospect>
  updateProspect(ref: string, patch: ProspectInput): Promise<Prospect>

  moveProspect(
    ref: string,
    stage: string,
    index?: number,
    pipeline?: string
  ): Promise<{ prospect: Prospect; client: Client | null }>

  removeProspect(ref: string): Promise<void>

  listContacts(filter: ContactFilter): Promise<ContactsPage>
  getContact(id: string): Promise<ContactDetail>
  createContact(input: ContactInput): Promise<Contact>
  updateContact(id: string, patch: ContactInput): Promise<Contact>
  removeContact(id: string): Promise<void>

  subscribeContact(id: string): Promise<Contact>
  unsubscribeContact(id: string): Promise<Contact>

  tagContact(id: string, change: { add?: string[]; remove?: string[] }): Promise<ContactBrief>

  promoteContact(id: string, stage?: string): Promise<{ contact: Contact; prospect: Prospect }>

  convertContact(id: string, input: ConvertInput): Promise<{ contact: Contact; prospect: Prospect }>

  detachContactProspect(id: string): Promise<Contact>

  pickRecording(): Promise<string | null>

  importRecording(path: string, info: ImportInfo): Promise<Meeting>

  listMeetings(filter: MeetingFilter): Promise<MeetingsPage>
  getMeeting(id: string): Promise<Meeting>
  createMeeting(input: MeetingInput): Promise<Meeting>
  updateMeeting(id: string, patch: MeetingInput): Promise<Meeting>
  removeMeeting(id: string): Promise<void>
  updateActionItem(id: string, index: number, patch: Partial<ActionItem>): Promise<Meeting>

  processMeeting(id: string): Promise<Meeting>

  suggestAssociation(title: string): Promise<{
    clientId: string | null
    projectId: string | null
    prospectId: string | null
  }>
  listActionItems(filter: { client?: string; done?: boolean }): Promise<OpenActionItem[]>

  listDocuments(client: string): Promise<DocFile[]>
  readDocument(client: string, path: string): Promise<{ path: string; content: string }>

  openDocument(client: string, path: string): Promise<DocContent>
  writeDocument(
    client: string,
    path: string,
    content: string,
    expectedModifiedAt?: string
  ): Promise<{ path: string; modifiedAt: string }>

  renameDocument(client: string, path: string, name: string): Promise<{ path: string }>

  trashDocument(client: string, path: string): Promise<void>
  appendNote(entity: NoteEntity, ref: string, text: string): Promise<void>
}

// ---- Utilidades ----

export function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function openChecklist(md: string): string[] {
  return [...md.matchAll(/^\s*[-*+]\s+\[ \]\s+(.+)$/gm)].map((m) => m[1].trim())
}

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
