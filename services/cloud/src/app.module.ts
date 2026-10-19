import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common'
import { Pool } from 'pg'
import { GetEntitlements } from './application/get-entitlements'
import { loadConfig } from './config'
import {
  ACCOUNT_ADMIN,
  CLOCK,
  DEVICES,
  MAILER,
  NOTIFIER,
  OBJECT_STORAGE,
  BLOBS,
  SYNC_STORE,
  MEMBERSHIPS,
  ORGS,
  OWNERSHIP,
  PROFILES,
  TOKEN_VERIFIER,
  type AccountAdmin,
  type Clock,
  type DeviceRepository,
  type ChangeNotifier,
  type Mailer,
  type ObjectStorage,
  type BlobRepository,
  type SyncStore,
  type MembershipRepository,
  type OrgRepository,
  type OwnershipRepository,
  type ProfileRepository
} from './ports'
import {
  DeleteAccount,
  ForgetOtherDevices,
  ListDevices,
  RegisterDevice,
  UpdateProfile
} from './application/account'
import { GetProfile } from './application/get-profile'
import { ManageOrganizations } from './application/organizations'
import { SyncMutations } from './application/sync'
import { ReadActivity } from './application/activity'
import { ActivityController } from './adapters/http/activity.controller'
import { ManageFiles } from './application/files'
import { CRON_SECRET, FilesController, InternalController } from './adapters/http/files.controller'
import { S3Storage } from './adapters/storage/s3-storage'
import { PgBlobRepository } from './adapters/postgres/pg-blob.repository'
import { SyncController } from './adapters/http/sync.controller'
import { PgSyncStore } from './adapters/postgres/pg-sync.store'
import { RealtimeNotifier } from './adapters/supabase/realtime-notifier'
import {
  InvitationsController,
  OrganizationsController
} from './adapters/http/organizations.controller'
import { DOWNLOAD_URL, InvitePageController } from './adapters/http/invite-page.controller'
import { PgOrgRepository } from './adapters/postgres/pg-org.repository'
import { DeliveryMailer, NoMailer } from './adapters/mail/delivery-mailer'
import { resendHttpSender } from '@shared/email-delivery/providers/resend/http-sender'
import { AccountController } from './adapters/http/account.controller'
import { PgAccountRepository } from './adapters/postgres/pg-account.repository'
import { SupabaseAdmin } from './adapters/supabase/supabase-admin'
import { HealthController } from './adapters/http/health.controller'
import { EntitlementsController } from './adapters/http/entitlements.controller'
import { AuthGuard } from './adapters/http/auth.guard'
import { SupabaseTokenVerifier } from './adapters/supabase/supabase-token-verifier'
import { PgMembershipRepository } from './adapters/postgres/pg-membership.repository'

const config = loadConfig()
const POOL = Symbol('Pool')
const ACCOUNTS = Symbol('PgAccountRepository')

const useCase = <T>(
  provide: abstract new (...args: never[]) => T,
  inject: symbol[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cada fábrica tipa sus puertos
  useFactory: (...deps: any[]) => T
): { provide: typeof provide; inject: symbol[]; useFactory: typeof useFactory } => ({
  provide,
  inject,
  useFactory
})

@Module({
  controllers: [
    HealthController,
    EntitlementsController,
    AccountController,
    OrganizationsController,
    InvitationsController,
    InvitePageController,
    SyncController,
    ActivityController,
    FilesController,
    InternalController
  ],
  providers: [
    AuthGuard,
    {
      provide: POOL,
      useFactory: () => new Pool({ connectionString: config.databaseUrl, max: 10 })
    },
    { provide: TOKEN_VERIFIER, useFactory: () => new SupabaseTokenVerifier(config.supabaseUrl) },
    { provide: CLOCK, useValue: { now: () => Date.now() } satisfies Clock },
    {
      provide: MEMBERSHIPS,
      inject: [POOL],
      useFactory: (pool: Pool) => new PgMembershipRepository(pool)
    },
    {
      provide: ACCOUNTS,
      inject: [POOL],
      useFactory: (pool: Pool) => new PgAccountRepository(pool)
    },
    { provide: PROFILES, useExisting: ACCOUNTS },
    { provide: ORGS, inject: [POOL], useFactory: (pool: Pool) => new PgOrgRepository(pool) },
    {
      provide: MAILER,
      useFactory: (): Mailer =>
        config.mailProvider === 'resend' && config.resendApiKey
          ? new DeliveryMailer(resendHttpSender(config.resendApiKey), config.mailFrom)
          : new NoMailer()
    },
    { provide: DOWNLOAD_URL, useValue: config.downloadUrl },
    { provide: CRON_SECRET, useValue: config.cronSecret },
    { provide: OBJECT_STORAGE, useFactory: () => new S3Storage(config.s3) },
    { provide: BLOBS, inject: [POOL], useFactory: (pool: Pool) => new PgBlobRepository(pool) },
    useCase(
      ManageFiles,
      [OBJECT_STORAGE, BLOBS, MEMBERSHIPS],
      (o: ObjectStorage, b: BlobRepository, m: MembershipRepository) =>
        new ManageFiles(o, b, m, config.maxFileBytes)
    ),
    { provide: SYNC_STORE, inject: [POOL], useFactory: (pool: Pool) => new PgSyncStore(pool) },
    {
      provide: NOTIFIER,
      useFactory: () => new RealtimeNotifier(config.supabaseUrl, config.serviceRoleKey)
    },
    useCase(
      SyncMutations,
      [SYNC_STORE, MEMBERSHIPS, NOTIFIER, CLOCK],
      (s: SyncStore, m: MembershipRepository, n: ChangeNotifier, c: Clock) =>
        new SyncMutations(s, m, n, c)
    ),
    useCase(
      ReadActivity,
      [SYNC_STORE, MEMBERSHIPS],
      (s: SyncStore, m: MembershipRepository) => new ReadActivity(s, m)
    ),
    useCase(
      ManageOrganizations,
      [ORGS, MEMBERSHIPS, PROFILES, MAILER, CLOCK],
      (o: OrgRepository, m: MembershipRepository, p: ProfileRepository, mail: Mailer, c: Clock) =>
        new ManageOrganizations(o, m, p, mail, c, config.publicUrl)
    ),
    { provide: DEVICES, useExisting: ACCOUNTS },
    { provide: OWNERSHIP, useExisting: ACCOUNTS },
    {
      provide: ACCOUNT_ADMIN,
      useFactory: () => new SupabaseAdmin(config.supabaseUrl, config.serviceRoleKey)
    },
    useCase(GetProfile, [PROFILES], (p: ProfileRepository) => new GetProfile(p)),
    useCase(UpdateProfile, [PROFILES], (p: ProfileRepository) => new UpdateProfile(p)),
    useCase(RegisterDevice, [DEVICES], (d: DeviceRepository) => new RegisterDevice(d)),
    useCase(ListDevices, [DEVICES], (d: DeviceRepository) => new ListDevices(d)),
    useCase(ForgetOtherDevices, [DEVICES], (d: DeviceRepository) => new ForgetOtherDevices(d)),
    useCase(
      DeleteAccount,
      [OWNERSHIP, ACCOUNT_ADMIN],
      (o: OwnershipRepository, a: AccountAdmin) => new DeleteAccount(o, a)
    ),
    {
      provide: GetEntitlements,
      inject: [MEMBERSHIPS, CLOCK],
      useFactory: (memberships: MembershipRepository, clock: Clock) =>
        new GetEntitlements(memberships, clock)
    }
  ]
})
export class AppModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: Pool) {}

  onApplicationShutdown(): Promise<void> {
    return this.pool.end()
  }
}

export const port = config.port
