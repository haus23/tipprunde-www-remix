/**
 * Pure domain rules of the Tipprunde. No I/O, fully unit tested.
 */
import type { Championship, ChampionshipPlayer, Match, Round, Tip } from './schemas.ts'

// ---------------------------------------------------------------------------
// Championships

/** The current championship is the published one with the highest `nr`. */
export function findCurrentChampionship(championships: readonly Championship[]): Championship | undefined {
  let current: Championship | undefined
  for (let championship of championships) {
    if (!championship.published) continue
    if (current === undefined || championship.nr > current.nr) current = championship
  }
  return current
}

export function findChampionship(championships: readonly Championship[], id: string): Championship | undefined {
  return championships.find((championship) => championship.published && championship.id === id)
}

/** Published championships, newest first. */
export function sortChampionships(championships: readonly Championship[]): Championship[] {
  return championships.filter((c) => c.published).toSorted((a, b) => b.nr - a.nr)
}

// ---------------------------------------------------------------------------
// Matches

/** The single definition of "evaluated": a match has a result. */
export function isEvaluated(match: Pick<Match, 'result'>): boolean {
  return match.result !== ''
}

/**
 * The chronologically last evaluated match: latest `date`, ties broken by the
 * higher `nr`. Undated matches sort before dated ones.
 */
export function findLastEvaluatedMatch(matches: readonly Match[]): Match | undefined {
  let last: Match | undefined
  for (let match of matches) {
    if (!isEvaluated(match)) continue
    if (last === undefined || compareChronologically(match, last) > 0) last = match
  }
  return last
}

function compareChronologically(a: Match, b: Match) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return a.nr - b.nr
}

export function sortByNr<T extends { nr: number }>(items: readonly T[]): T[] {
  return items.toSorted((a, b) => a.nr - b.nr)
}

/** Default: last evaluated match, otherwise the match with the smallest `nr`. */
export function defaultMatch(matches: readonly Match[]): Match | undefined {
  return findLastEvaluatedMatch(matches) ?? sortByNr(matches)[0]
}

/** Parses the `nr` query parameter. Anything but a positive integer is ignored. */
export function parseMatchNr(value: string | null | undefined): number | undefined {
  if (value == null || !/^\d{1,6}$/.test(value)) return undefined
  let nr = Number(value)
  return nr >= 1 ? nr : undefined
}

export interface MatchSelection {
  match: Match | undefined
  /** The requested `nr` did not match any match and the default was used instead. */
  fallback: boolean
}

export function selectMatch(matches: readonly Match[], requestedNr: string | null | undefined): MatchSelection {
  let nr = parseMatchNr(requestedNr)
  let requested = nr === undefined ? undefined : matches.find((match) => match.nr === nr)
  if (requested) return { match: requested, fallback: false }
  return { match: defaultMatch(matches), fallback: requestedNr != null }
}

/** Immediate neighbours by ascending `nr`; `undefined` at either end. */
export function findNeighbours(matches: readonly Match[], match: Match) {
  let sorted = sortByNr(matches)
  let index = sorted.findIndex((candidate) => candidate.id === match.id)
  return {
    previous: index > 0 ? sorted[index - 1] : undefined,
    next: index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : undefined,
  }
}

export interface RoundGroup {
  round: Round
  matches: Match[]
}

/** Rounds ordered by `nr`, each with its matches ordered by `nr`. */
export function groupByRound(rounds: readonly Round[], matches: readonly Match[]): RoundGroup[] {
  let groups = sortByNr(rounds).map((round) => ({ round, matches: [] as Match[] }))
  let byId = new Map(groups.map((group) => [group.round.id, group]))
  for (let match of sortByNr(matches)) byId.get(match.roundId)?.matches.push(match)
  return groups
}

// ---------------------------------------------------------------------------
// Players

export function hasRanking(players: readonly ChampionshipPlayer[]): boolean {
  return players.some((player) => player.rank !== undefined)
}

/**
 * The table leader: smallest existing `rank` (first in API order on ties).
 * Without any ranking the first participant delivered by the API is used.
 */
export function defaultPlayer(players: readonly ChampionshipPlayer[]): ChampionshipPlayer | undefined {
  let leader: ChampionshipPlayer | undefined
  for (let player of players) {
    if (player.rank === undefined) continue
    if (leader?.rank === undefined || player.rank < leader.rank) leader = player
  }
  return leader ?? players[0]
}

export interface PlayerSelection {
  player: ChampionshipPlayer | undefined
  fallback: boolean
}

/** @param requestedAccountId value of `?name=`, compared with `ChampionshipPlayer.playerId`. */
export function selectPlayer(
  players: readonly ChampionshipPlayer[],
  requestedAccountId: string | null | undefined,
): PlayerSelection {
  let requested = requestedAccountId ? players.find((player) => player.playerId === requestedAccountId) : undefined
  if (requested) return { player: requested, fallback: false }
  return { player: defaultPlayer(players), fallback: requestedAccountId != null }
}

// ---------------------------------------------------------------------------
// Tips

/** A tip only counts as submitted when it carries a score. */
export function hasTip(tip: Tip | undefined): tip is Tip {
  return tip !== undefined && tip.tip !== ''
}

export type TipCell =
  /** Match not evaluated yet: no points to show. */
  | { kind: 'open'; tip: Tip | undefined }
  /** Evaluated, no tip submitted: displayed as 0 points. */
  | { kind: 'missing'; tip: Tip | undefined; points: number }
  /** Evaluated with a submitted tip and calculated points (may be 0). */
  | { kind: 'scored'; tip: Tip; points: number }
  /** Evaluated with a submitted tip but no calculated points: unknown, never 0. */
  | { kind: 'uncalculated'; tip: Tip }

export function describeTip(match: Pick<Match, 'result'>, tip: Tip | undefined): TipCell {
  if (!isEvaluated(match)) return { kind: 'open', tip }
  if (tip === undefined || tip.tip === '') return { kind: 'missing', tip, points: tip?.points ?? 0 }
  if (tip.points === undefined) return { kind: 'uncalculated', tip }
  return { kind: 'scored', tip, points: tip.points }
}

/** Points that can be summed up; `undefined` for open or uncalculated cells. */
export function cellPoints(cell: TipCell): number | undefined {
  return cell.kind === 'scored' || cell.kind === 'missing' ? cell.points : undefined
}

// ---------------------------------------------------------------------------
// Statistics

export function countEvaluated(matches: readonly Match[]): number {
  return matches.filter(isEvaluated).length
}

/**
 * Average = regular points / number of evaluated matches.
 * Extra points and the number of submitted tips are not part of it.
 */
export function pointsAverage(points: number | undefined, evaluatedMatches: number): number | undefined {
  if (points === undefined || evaluatedMatches === 0) return undefined
  return points / evaluatedMatches
}

export interface RoundStats {
  evaluated: number
  points: number
  average: number | undefined
}

export function roundStats(matches: readonly Match[], tipsByMatchId: Readonly<Record<string, Tip>>): RoundStats {
  let evaluated = 0
  let points = 0
  for (let match of matches) {
    if (!isEvaluated(match)) continue
    evaluated++
    points += cellPoints(describeTip(match, tipsByMatchId[match.id])) ?? 0
  }
  return { evaluated, points, average: pointsAverage(points, evaluated) }
}

export type TableKind = 'participants' | 'running' | 'final'

export function tableKind(championship: Championship, players: readonly ChampionshipPlayer[]): TableKind {
  if (!hasRanking(players)) return 'participants'
  return championship.completed ? 'final' : 'running'
}

/** Points shown in the table: `totalPoints` only includes extra points when they are published. */
export function tablePoints(player: ChampionshipPlayer, championship: Championship): number | undefined {
  return championship.extraPointsPublished ? player.totalPoints : player.points
}
