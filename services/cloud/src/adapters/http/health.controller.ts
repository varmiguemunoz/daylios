import { Controller, Get } from '@nestjs/common'
import { SYNC_PROTOCOL_VERSION, type HealthResponse } from '@shared/sync-protocol'

@Controller('health')
export class HealthController {
  @Get()
  health(): HealthResponse {
    return {
      ok: true,
      version: process.env.npm_package_version ?? '0.0.0',
      protocol: SYNC_PROTOCOL_VERSION
    }
  }
}
