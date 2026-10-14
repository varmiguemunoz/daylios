import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common'
import {
  MIN_CLIENT_PROTOCOL,
  PROTOCOL_HEADER,
  type BootstrapResponse,
  type PullResponse,
  type PushRequest,
  type PushResponse
} from '@shared/sync-protocol'
import { SyncMutations } from '../../application/sync'
import { AuthGuard, type AuthedRequest } from './auth.guard'
import { run } from './errors'

const UPGRADE = 426

function requireProtocol(value: string | undefined): void {
  if (Number(value ?? 0) < MIN_CLIENT_PROTOCOL) {
    throw new HttpException({ message: 'Actualiza DayliOS para seguir sincronizando.' }, UPGRADE)
  }
}

@Controller('sync')
@UseGuards(AuthGuard)
export class SyncController {
  constructor(private readonly sync: SyncMutations) {}

  @Post('push')
  push(
    @Req() req: AuthedRequest,
    @Headers(PROTOCOL_HEADER) protocol: string | undefined,
    @Body() body: PushRequest
  ): Promise<PushResponse> {
    requireProtocol(protocol)
    return run(() => this.sync.push(req.user, body))
  }

  @Get(':orgId/pull')
  pull(
    @Req() req: AuthedRequest,
    @Headers(PROTOCOL_HEADER) protocol: string | undefined,
    @Param('orgId') orgId: string,
    @Query('since') since: string
  ): Promise<PullResponse> {
    requireProtocol(protocol)
    return run(() => this.sync.pull(req.user, orgId, since))
  }

  @Get(':orgId/bootstrap')
  bootstrap(
    @Req() req: AuthedRequest,
    @Headers(PROTOCOL_HEADER) protocol: string | undefined,
    @Param('orgId') orgId: string,
    @Query('after') after: string
  ): Promise<BootstrapResponse> {
    requireProtocol(protocol)
    return run(() => this.sync.bootstrap(req.user, orgId, after))
  }
}
