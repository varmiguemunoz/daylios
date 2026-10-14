import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Put,
  Query,
  Req,
  UseGuards
} from '@nestjs/common'
import { initials, type Device } from '../../domain/account'
import {
  DeleteAccount,
  ForgetOtherDevices,
  ListDevices,
  RegisterDevice,
  UpdateProfile
} from '../../application/account'
import { GetProfile } from '../../application/get-profile'
import { AuthGuard, type AuthedRequest } from './auth.guard'
import { run } from './errors'

export interface ProfileResponse {
  userId: string
  email: string | null
  name: string | null
  initials: string
}

@Controller('me')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(
    private readonly getProfile: GetProfile,
    private readonly updateProfile: UpdateProfile,
    private readonly registerDevice: RegisterDevice,
    private readonly listDevices: ListDevices,
    private readonly forgetOthers: ForgetOtherDevices,
    private readonly deleteAccount: DeleteAccount
  ) {}

  @Get()
  async profile(@Req() req: AuthedRequest): Promise<ProfileResponse> {
    const p = await this.getProfile.execute(req.user)
    return { ...p, initials: initials(p.name, p.email) }
  }

  @Patch()
  async rename(
    @Req() req: AuthedRequest,
    @Body() body: { name?: unknown }
  ): Promise<ProfileResponse> {
    const p = await run(() => this.updateProfile.execute(req.user, body))
    return { ...p, initials: initials(p.name, p.email) }
  }

  @Get('devices')
  devices(@Req() req: AuthedRequest): Promise<Device[]> {
    return this.listDevices.execute(req.user)
  }

  @Put('devices/:id')
  touch(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { name?: unknown; platform?: unknown }
  ): Promise<Device> {
    return run(() => this.registerDevice.execute(req.user, id, body))
  }

  @Delete('devices')
  async others(
    @Req() req: AuthedRequest,
    @Query('keep') keep: string
  ): Promise<{ removed: number }> {
    return { removed: await run(() => this.forgetOthers.execute(req.user, keep)) }
  }

  @Delete()
  @HttpCode(200)
  remove(
    @Req() req: AuthedRequest,
    @Body() body: { confirm?: unknown }
  ): Promise<{ deletedOrgs: string[] }> {
    return run(() => this.deleteAccount.execute(req.user, body?.confirm))
  }
}
