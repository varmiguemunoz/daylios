import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext
} from '@nestjs/common'
import type { Request } from 'express'
import { TOKEN_VERIFIER, type AuthUser, type TokenVerifier } from '../../ports'

export type AuthedRequest = Request & { user: AuthUser }

/** Exige un token de Supabase válido en `Authorization: Bearer`. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>()
    const header = req.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (!token) throw new UnauthorizedException('Falta el token.')
    try {
      req.user = await this.verifier.verify(token)
      return true
    } catch {
      throw new UnauthorizedException('Token inválido o caducado.')
    }
  }
}
