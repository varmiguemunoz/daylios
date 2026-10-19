import { DeliveryUsageError } from '@shared/email-delivery'
import { AppError } from './app.error'

const asAppError = (error: unknown): unknown =>
  error instanceof DeliveryUsageError ? new AppError('invalid', error.message) : error

export function delivery<T>(fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    throw asAppError(error)
  }
}

export async function deliveryCall<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise
  } catch (error) {
    throw asAppError(error)
  }
}
