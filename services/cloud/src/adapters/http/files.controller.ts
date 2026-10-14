import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common'
import { timingSafeEqual } from 'crypto'
import type {
  CompleteUploadRequest,
  DownloadResponse,
  PartUrl,
  PartUrlsRequest,
  UploadPlan,
  UploadRequest,
  UsageResponse
} from '@shared/files'
import { ManageFiles } from '../../application/files'
import { AuthGuard, type AuthedRequest } from './auth.guard'
import { run } from './errors'

export const CRON_SECRET = Symbol('CronSecret')

@Controller('files')
@UseGuards(AuthGuard)
export class FilesController {
  constructor(private readonly files: ManageFiles) {}

  @Post(':orgId/uploads')
  upload(
    @Req() req: AuthedRequest,
    @Param('orgId') orgId: string,
    @Body() body: UploadRequest
  ): Promise<UploadPlan> {
    return run(() => this.files.requestUpload(req.user, orgId, body))
  }

  @Post(':orgId/uploads/parts')
  parts(
    @Req() req: AuthedRequest,
    @Param('orgId') orgId: string,
    @Body() body: PartUrlsRequest
  ): Promise<{ parts: PartUrl[] }> {
    return run(() => this.files.partUrls(req.user, orgId, body))
  }

  @Post(':orgId/uploads/complete')
  complete(
    @Req() req: AuthedRequest,
    @Param('orgId') orgId: string,
    @Body() body: CompleteUploadRequest
  ): Promise<{ ok: true }> {
    return run(() => this.files.completeUpload(req.user, orgId, body))
  }

  @Get(':orgId/blobs/:hash')
  download(
    @Req() req: AuthedRequest,
    @Param('orgId') orgId: string,
    @Param('hash') hash: string
  ): Promise<DownloadResponse> {
    return run(() => this.files.download(req.user, orgId, hash))
  }

  @Get(':orgId/usage')
  usage(@Req() req: AuthedRequest, @Param('orgId') orgId: string): Promise<UsageResponse> {
    return run(() => this.files.usage(req.user, orgId))
  }
}

@Controller('internal')
export class InternalController {
  constructor(
    private readonly files: ManageFiles,
    @Inject(CRON_SECRET) private readonly secret: string | null
  ) {}

  @Post('purge')
  async purge(@Headers('x-cron-secret') given: string | undefined): Promise<{ removed: number }> {
    const expected = Buffer.from(this.secret ?? '')
    const actual = Buffer.from(given ?? '')
    if (!this.secret || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new ForbiddenException()
    }
    return { removed: await this.files.purge() }
  }
}
