import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common'
import type { ActivityPage } from '@shared/activity'
import { ReadActivity } from '../../application/activity'
import { AuthGuard, type AuthedRequest } from './auth.guard'
import { run } from './errors'

@Controller('activity')
@UseGuards(AuthGuard)
export class ActivityController {
  constructor(private readonly activity: ReadActivity) {}

  @Get(':orgId')
  list(
    @Req() req: AuthedRequest,
    @Param('orgId') orgId: string,
    @Query('since') since: string
  ): Promise<ActivityPage> {
    return run(() => this.activity.list(req.user, orgId, since))
  }
}
