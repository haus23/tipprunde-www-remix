import type { ChampionshipMatches, Match } from '../data/schemas.ts'

export const OPEN_TEAM = 'offen'

/** Team name for a (possibly still open) slot. */
export function teamName(data: Pick<ChampionshipMatches, 'teams'>, teamId: string, size: 'short' | 'long'): string {
  let team = teamId ? data.teams[teamId] : undefined
  if (!team) return OPEN_TEAM
  return size === 'short' ? team.shortname : team.name
}

export function matchLabel(data: Pick<ChampionshipMatches, 'teams'>, match: Match, size: 'short' | 'long' = 'short') {
  return `${teamName(data, match.hometeamId, size)} – ${teamName(data, match.awayteamId, size)}`
}

export function leagueName(data: Pick<ChampionshipMatches, 'leagues'>, match: Match): string | undefined {
  return match.leagueId ? data.leagues[match.leagueId]?.name : undefined
}
