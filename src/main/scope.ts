let teamUser: string | null = null

export const setTeamUser = (userId: string | null): void => {
  teamUser = userId
}

export const teamUserId = (): string | null => teamUser
