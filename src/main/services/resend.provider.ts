import { createResendGateway, type ResendGateway } from '@shared/resend-gateway'
import { config } from '../config'

export type GatewayProvider = () => ResendGateway | null

let cached: { key: string; gateway: ResendGateway } | null = null

export const resendFromConfig: GatewayProvider = () => {
  const key = config.resendKey()
  if (!key) return null
  if (cached?.key !== key) cached = { key, gateway: createResendGateway(key) }
  return cached.gateway
}
