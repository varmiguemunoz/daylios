import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from '@nestjs/common'
import type {
  InvitePreview,
  InviteResult,
  OrgDetail,
  OrgSummary,
  Role
} from '@shared/organizations'
import { ManageOrganizations } from '../../application/organizations'
import { AuthGuard, type AuthedRequest } from './auth.guard'
import { run } from './errors'

@Controller('orgs')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private readonly orgs: ManageOrganizations) {}

  @Get()
  list(@Req() req: AuthedRequest): Promise<OrgSummary[]> {
    return run(() => this.orgs.list(req.user))
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: { name?: unknown }): Promise<OrgSummary> {
    return run(() => this.orgs.create(req.user, body?.name))
  }

  @Get(':orgId')
  detail(@Req() req: AuthedRequest, @Param('orgId') orgId: string): Promise<OrgDetail> {
    return run(() => this.orgs.detail(req.user, orgId))
  }

  @Patch(':orgId')
  rename(
    @Req() req: AuthedRequest,
    @Param('orgId') orgId: string,
    @Body() body: { name?: unknown }
  ): Promise<OrgDetail> {
    return run(() => this.orgs.rename(req.user, orgId, body?.name))
  }

  @Delete(':orgId')
  @HttpCode(204)
  remove(
    @Req() req: AuthedRequest,
    @Param('orgId') orgId: string,
    @Body() body: { confirm?: unknown }
  ): Promise<void> {
    return run(() => this.orgs.remove(req.user, orgId, body?.confirm))
  }

  @Post(':orgId/transfer')
  transfer(
    @Req() req: AuthedRequest,
    @Param('orgId') orgId: string,
    @Body() body: { userId?: unknown }
  ): Promise<OrgDetail> {
    return run(() => this.orgs.transfer(req.user, orgId, body?.userId))
  }

  @Post(':orgId/invitations')
  invite(
    @Req() req: AuthedRequest,
    @Param('orgId') orgId: string,
    @Body() body: { email?: unknown; role?: unknown }
  ): Promise<InviteResult> {
    return run(() => this.orgs.invite(req.user, orgId, body))
  }

  @Post(':orgId/invitations/:id/resend')
  resend(
    @Req() req: AuthedRequest,
    @Param('orgId') orgId: string,
    @Param('id') id: string
  ): Promise<InviteResult> {
    return run(() => this.orgs.resend(req.user, orgId, id))
  }

  @Delete(':orgId/invitations/:id')
  revoke(
    @Req() req: AuthedRequest,
    @Param('orgId') orgId: string,
    @Param('id') id: string
  ): Promise<OrgDetail> {
    return run(() => this.orgs.revoke(req.user, orgId, id))
  }

  @Patch(':orgId/members/:userId')
  role(
    @Req() req: AuthedRequest,
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body() body: { role?: Role }
  ): Promise<OrgDetail> {
    return run(() => this.orgs.changeRole(req.user, orgId, userId, body?.role))
  }

  @Delete(':orgId/members/:userId')
  removeMember(
    @Req() req: AuthedRequest,
    @Param('orgId') orgId: string,
    @Param('userId') userId: string
  ): Promise<OrgDetail> {
    return run(() => this.orgs.removeMember(req.user, orgId, userId))
  }

  @Post(':orgId/leave')
  @HttpCode(204)
  leave(@Req() req: AuthedRequest, @Param('orgId') orgId: string): Promise<void> {
    return run(() => this.orgs.leave(req.user, orgId))
  }
}

@Controller('invitations')
@UseGuards(AuthGuard)
export class InvitationsController {
  constructor(private readonly orgs: ManageOrganizations) {}

  @Get(':token')
  preview(@Req() req: AuthedRequest, @Param('token') token: string): Promise<InvitePreview> {
    return run(() => this.orgs.preview(req.user, token))
  }

  @Post(':token/accept')
  accept(@Req() req: AuthedRequest, @Param('token') token: string): Promise<OrgSummary> {
    return run(() => this.orgs.accept(req.user, token))
  }
}
