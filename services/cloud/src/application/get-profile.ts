import type { Profile } from '../domain/account'
import type { AuthUser, ProfileRepository } from '../ports'

export class GetProfile {
  constructor(private readonly profiles: ProfileRepository) {}

  execute(user: AuthUser): Promise<Profile> {
    return this.profiles.get(user)
  }
}
