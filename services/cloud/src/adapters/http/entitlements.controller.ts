import { BadRequestException, Controller, Get, Param, Req, UseGuards } from '@nestjs/common'
import type { EntitlementsResponse } from '@shared/sync-protocol'
import { GetEntitlements } from '../../application/get-entitlements'
import { AuthGuard, type AuthedRequest } from './auth.guard'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Qué puede usar la persona en una organización. Sin membresía activa, una lista vacía. */
@Controller('orgs')
@UseGuards(AuthGuard)
export class EntitlementsController {
  constructor(private readonly getEntitlements: GetEntitlements) {}

  @Get(':orgId/entitlements')
  entitlements(
    @Req() req: AuthedRequest,
    @Param('orgId') orgId: string
  ): Promise<EntitlementsResponse> {
    if (!UUID.test(orgId)) throw new BadRequestException('Organización inválida.')
    return this.getEntitlements.execute(req.user, orgId)
  }
}
