import type { Device, Ownership, Profile } from '../domain/account'
import type { Role } from '@shared/organizations'
import type { PulledMutation, SyncMutation, BootstrapRecord } from '@shared/sync-protocol'
import type { RecordState } from '@shared/sync-merge'
import type { ActivityEntry } from '@shared/activity'
import type { ActivityDraft } from '../domain/activity'
import type { Invitation } from '../domain/invitation'
import type { Membership, Organization } from '../domain/membership'

export interface AuthUser {
  userId: string
  email: string | null
}

export interface TokenVerifier {
  verify(token: string): Promise<AuthUser>
}

export interface MembershipRepository {
  find(user: AuthUser, orgId: string): Promise<{ org: Organization; membership: Membership } | null>
}

export interface Clock {
  now(): number
}

export interface ProfileRepository {
  get(user: AuthUser): Promise<Profile>
  setName(user: AuthUser, name: string): Promise<Profile>
}

export interface DeviceRepository {
  list(user: AuthUser): Promise<Device[]>
  touch(user: AuthUser, device: { id: string; name: string; platform: string }): Promise<Device>
  removeOthers(user: AuthUser, keepId: string): Promise<number>
}

export interface OwnershipRepository {
  owned(user: AuthUser): Promise<Ownership[]>
}

export interface AccountAdmin {
  deleteOrganizations(orgIds: string[]): Promise<void>
  deleteUser(userId: string): Promise<void>
}

export interface OrgRow extends Organization {
  role: Role
  members: number
}

export interface MemberRow {
  userId: string
  name: string | null
  email: string | null
  role: Role
}

export interface InvitationRow extends Invitation {
  orgName: string
}

export interface OrgRepository {
  listMine(user: AuthUser): Promise<OrgRow[]>
  create(user: AuthUser, name: string): Promise<string>
  rename(user: AuthUser, orgId: string, name: string): Promise<void>
  softDelete(user: AuthUser, orgId: string): Promise<void>
  transfer(user: AuthUser, orgId: string, newOwner: string): Promise<void>
  members(user: AuthUser, orgId: string): Promise<MemberRow[]>
  invitations(user: AuthUser, orgId: string): Promise<Invitation[]>
  insertInvitation(
    user: AuthUser,
    inv: Omit<Invitation, 'id' | 'createdAt' | 'acceptedAt' | 'revokedAt'>
  ): Promise<Invitation>
  invitation(user: AuthUser, orgId: string, id: string): Promise<Invitation | null>
  renewInvitation(
    user: AuthUser,
    id: string,
    tokenHash: string,
    expiresAt: string
  ): Promise<Invitation>
  revokeInvitation(user: AuthUser, id: string): Promise<void>
  invitationByHash(user: AuthUser, hash: string): Promise<InvitationRow | null>
  acceptInvitation(user: AuthUser, hash: string): Promise<string>
  setRole(user: AuthUser, orgId: string, userId: string, role: Role): Promise<void>
  removeMember(user: AuthUser, orgId: string, userId: string): Promise<void>
  leave(user: AuthUser, orgId: string): Promise<void>
  audit(user: AuthUser, orgId: string, action: string, target?: string): Promise<void>
}

export interface InviteMail {
  to: string
  orgName: string
  inviterName: string | null
  role: Role
  link: string
}

export interface Mailer {
  sendInvite(mail: InviteMail): Promise<boolean>
}

export interface SyncTransaction {
  insertMutation(m: SyncMutation, by: string): Promise<boolean>
  record(entity: string, id: string): Promise<RecordState | null>
  saveRecord(entity: string, state: RecordState): Promise<void>
  cursor(): Promise<number>
  addActivity(draft: ActivityDraft, actorId: string): Promise<void>
}

export interface SyncStore {
  write<T>(user: AuthUser, orgId: string, work: (tx: SyncTransaction) => Promise<T>): Promise<T>
  pull(user: AuthUser, orgId: string, since: number, limit: number): Promise<PulledMutation[]>
  cursor(user: AuthUser, orgId: string): Promise<number>
  records(
    user: AuthUser,
    orgId: string,
    after: string | null,
    limit: number
  ): Promise<{ records: BootstrapRecord[]; total: number }>
  activity(user: AuthUser, orgId: string, since: number, limit: number): Promise<ActivityEntry[]>
}

export interface ChangeNotifier {
  changes(orgId: string, cursor: number): Promise<void>
}

export interface ObjectStorage {
  presignPut(key: string, size: number): Promise<string>
  createMultipart(key: string): Promise<string>
  presignPart(key: string, uploadId: string, partNumber: number): Promise<string>
  completeMultipart(
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[]
  ): Promise<void>
  presignGet(key: string): Promise<string>
  size(key: string): Promise<number | null>
  remove(key: string): Promise<void>
}

export interface BlobRepository {
  exists(user: AuthUser, orgId: string, hash: string): Promise<boolean>
  add(user: AuthUser, orgId: string, hash: string, size: number): Promise<void>
  usage(user: AuthUser, orgId: string): Promise<{ bytes: number; limitBytes: number }>
  purgeCandidates(graceDays: number, trashDays: number): Promise<{ orgId: string; hash: string }[]>
  forget(orgId: string, hash: string): Promise<void>
}

export const TOKEN_VERIFIER = Symbol('TokenVerifier')
export const MEMBERSHIPS = Symbol('MembershipRepository')
export const CLOCK = Symbol('Clock')
export const PROFILES = Symbol('ProfileRepository')
export const DEVICES = Symbol('DeviceRepository')
export const OWNERSHIP = Symbol('OwnershipRepository')
export const ACCOUNT_ADMIN = Symbol('AccountAdmin')
export const ORGS = Symbol('OrgRepository')
export const MAILER = Symbol('Mailer')
export const SYNC_STORE = Symbol('SyncStore')
export const NOTIFIER = Symbol('ChangeNotifier')
export const OBJECT_STORAGE = Symbol('ObjectStorage')
export const BLOBS = Symbol('BlobRepository')
