/**
 * Small, explicit fixtures shaped like real Unterbau responses.
 *
 * Participation ids (`ChampionshipPlayer.id`) and member ids
 * (`ChampionshipPlayer.playerId`) deliberately look different so that tests
 * catch any mix-up between them.
 */
import type {
  Championship,
  ChampionshipMatches,
  ChampionshipPlayer,
  CurrentTipsMatch,
  Match,
  Tip,
} from '../app/data/schemas.ts'

export function championship(overrides: Partial<Championship> = {}): Championship {
  return {
    id: 'hr2627',
    name: 'Hinrunde 2026/27',
    nr: 61,
    rulesId: 'aktuelle-fassung',
    published: true,
    extraPointsPublished: false,
    completed: false,
    ...overrides,
  }
}

export const championships: Championship[] = [
  championship(),
  championship({ id: 'wm2026', name: 'WM 2026', nr: 60, completed: true, extraPointsPublished: true }),
  championship({ id: 'rr2526', name: 'Rückrunde 2025/26', nr: 59, completed: true, extraPointsPublished: true }),
]

export function player(accountId: string, overrides: Partial<ChampionshipPlayer> = {}): ChampionshipPlayer {
  let name = accountId[0]!.toUpperCase() + accountId.slice(1)
  return {
    id: `part-${accountId}`,
    playerId: accountId,
    nr: 1,
    account: { id: accountId, name, email: '' },
    ...overrides,
  } as ChampionshipPlayer
}

export const rankedPlayers: ChampionshipPlayer[] = [
  player('duschi', { nr: 1, rank: 2, points: 30, extraPoints: 4, totalPoints: 30 }),
  player('tom', { nr: 2, rank: 1, points: 39, extraPoints: 0, totalPoints: 39 }),
  player('anna', { nr: 3, rank: 1, points: 39, extraPoints: 7, totalPoints: 39 }),
  player('micha', { nr: 4, rank: 4, points: 12, extraPoints: 3, totalPoints: 12 }),
]

export const unrankedPlayers: ChampionshipPlayer[] = [player('carla', { nr: 2 }), player('ben', { nr: 1 })]

export function match(nr: number, overrides: Partial<Match> = {}): Match {
  return {
    id: `match-${nr}`,
    nr,
    date: '',
    result: '',
    roundId: 'round-1',
    leagueId: 'bl',
    hometeamId: 'union',
    awayteamId: 'bayern',
    ...overrides,
  } as Match
}

export function tip(playerId: string, matchId: string, overrides: Partial<Tip> = {}): Tip {
  return { id: `tip-${playerId}-${matchId}`, tip: '1:1', joker: false, matchId, playerId, ...overrides } as Tip
}

export function matchesPayload(matches: Match[], rounds = [{ id: 'round-1', nr: 1, isDoubleRound: false }]): ChampionshipMatches {
  return {
    rounds,
    matches,
    teams: {
      union: { id: 'union', name: '1. FC Union Berlin', shortname: 'Union' },
      bayern: { id: 'bayern', name: 'FC Bayern München', shortname: 'Bayern' },
    },
    leagues: { bl: { id: 'bl', name: 'Bundesliga', shortname: 'BL' } },
  }
}

export function currentTipsMatch(nr: number, overrides: Partial<CurrentTipsMatch> = {}): CurrentTipsMatch {
  return { matchId: `match-${nr}`, nr, hometeam: 'Union', awayteam: 'Bayern', result: '', tips: {}, ...overrides }
}
