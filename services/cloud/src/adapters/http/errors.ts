import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from '@nestjs/common'
import { UseCaseError } from '../../application/errors'

export async function run<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (e) {
    if (!(e instanceof UseCaseError)) throw e
    const body = { message: e.message, detail: e.detail }
    if (e.kind === 'conflict') throw new ConflictException(body)
    if (e.kind === 'forbidden') throw new ForbiddenException(body)
    if (e.kind === 'not-found') throw new NotFoundException(body)
    throw new BadRequestException(body)
  }
}
