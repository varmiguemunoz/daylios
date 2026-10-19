export interface RemoteContact {
  id: string
  email: string
  unsubscribed: boolean
}

export interface RemoteGroup {
  id: string
  name: string
}

export interface ContactInput {
  email: string
  firstName?: string | null
  lastName?: string | null
  unsubscribed: boolean
  groupIds?: string[]
}

export interface ContactPatch {
  firstName?: string | null
  lastName?: string | null
  unsubscribed?: boolean
}

export interface AudienceStore {
  findContact(email: string): Promise<RemoteContact | null>
  createContact(input: ContactInput): Promise<string>
  updateContact(email: string, patch: ContactPatch): Promise<void>
  groupsOf(email: string): Promise<RemoteGroup[]>
  addToGroup(email: string, groupId: string): Promise<void>
  removeFromGroup(email: string, groupId: string): Promise<void>
  ensureGroup(name: string): Promise<string>
  deleteGroup(id: string): Promise<void>
}
