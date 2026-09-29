/**
 * Runtime schemas for the public, read-only Unterbau API (`/api/v1`).
 *
 * They mirror https://unterbau.runde.tips/openapi.json. Required fields and
 * value formats are validated; unknown keys are stripped. Optional fields stay
 * `undefined` so that "not evaluated yet" is never confused with `0`.
 */
import * as s from 'remix/data-schema'

const SCORE = /^\d{1,2}:\d{1,2}$|^$/
const DATE = /^\d{4}-[01]\d-[0-3]\d$|^$/
const SLUG = /^[a-z0-9-]+$/
const CHAMPIONSHIP_ID = /^[a-z]{2}\d{4}$/

const nonEmpty = () => s.string().refine((value) => value.length > 0, 'Expected a non-empty string')
const slug = () => s.string().refine((value) => SLUG.test(value), 'Expected a slug')
const positiveInt = () =>
  s.number().refine((value) => Number.isInteger(value) && value >= 1, 'Expected a positive integer')
const score = () => s.string().refine((value) => SCORE.test(value), 'Expected "h:a" or ""')

/** `"" | slug | null`, normalized to a plain string (`""` = open/unknown). */
const optionalRef = () =>
  s
    .defaulted(s.nullable(s.string()), '')
    .refine((value) => value === null || value === '' || SLUG.test(value), 'Expected a slug')
    .transform((value) => value ?? '')

export const Championship = s.object({
  id: s.string().refine((value) => CHAMPIONSHIP_ID.test(value), 'Expected a championship id'),
  name: nonEmpty(),
  nr: positiveInt(),
  rulesId: slug(),
  published: s.boolean(),
  extraPointsPublished: s.boolean(),
  completed: s.boolean(),
})
export const Championships = s.array(Championship)

export const Account = s.object({
  id: slug(),
  name: nonEmpty(),
  // Always "" in public responses. It is parsed so the shape stays honest,
  // but the UI never renders it.
  email: s.defaulted(s.string(), ''),
})

export const ChampionshipPlayer = s.object({
  /** Participation document id. Key of `tips` in match-tips and current-tips. */
  id: nonEmpty(),
  /** Member (account) id. Used for `?name=` in player-tips and the player route. */
  playerId: slug(),
  nr: positiveInt(),
  rank: s.optional(positiveInt()),
  points: s.optional(s.number()),
  extraPoints: s.optional(s.number()),
  totalPoints: s.optional(s.number()),
  account: Account,
})
export const ChampionshipPlayers = s.array(ChampionshipPlayer)

export const Round = s.object({
  id: nonEmpty(),
  nr: positiveInt(),
  isDoubleRound: s.defaulted(s.boolean(), false),
})

export const Match = s.object({
  id: nonEmpty(),
  nr: positiveInt(),
  date: s.defaulted(s.string().refine((value) => DATE.test(value), 'Expected YYYY-MM-DD or ""'), ''),
  result: s.defaulted(score(), ''),
  points: s.optional(s.number().refine((value) => value >= 0, 'Expected >= 0')),
  roundId: nonEmpty(),
  leagueId: optionalRef(),
  hometeamId: optionalRef(),
  awayteamId: optionalRef(),
})

export const Team = s.object({ id: slug(), name: nonEmpty(), shortname: nonEmpty() })
export const League = s.object({ id: slug(), name: nonEmpty(), shortname: nonEmpty() })

export const ChampionshipMatches = s.object({
  rounds: s.array(Round),
  matches: s.array(Match),
  teams: s.record(s.string(), Team),
  leagues: s.record(s.string(), League),
})

export const Tip = s.object({
  id: nonEmpty(),
  tip: score(),
  joker: s.boolean(),
  points: s.optional(s.number().refine((value) => value >= 0, 'Expected >= 0')),
  lonelyHit: s.optional(s.boolean()),
  matchId: nonEmpty(),
  /** Always a `ChampionshipPlayer.id`, never an account id. */
  playerId: nonEmpty(),
})

export const CurrentTipsMatch = s.object({
  matchId: nonEmpty(),
  nr: positiveInt(),
  hometeam: s.defaulted(s.string(), ''),
  awayteam: s.defaulted(s.string(), ''),
  result: s.defaulted(score(), ''),
  /** Keyed by `ChampionshipPlayer.id`. */
  tips: s.record(s.string(), Tip),
})
export const ChampionshipCurrentTips = s.array(CurrentTipsMatch)

export const ChampionshipPlayerTips = s.object({
  /** The `ChampionshipPlayer.id` of the selected member. */
  playerId: nonEmpty(),
  /** Keyed by match id. */
  tips: s.record(s.string(), Tip),
})

export const ChampionshipMatchTips = s.object({
  matchId: nonEmpty(),
  /** Keyed by `ChampionshipPlayer.id`. */
  tips: s.record(s.string(), Tip),
})

export const ApiErrorBody = s.object({ status: s.number(), error: s.string() })

export type Championship = s.InferOutput<typeof Championship>
export type ChampionshipPlayer = s.InferOutput<typeof ChampionshipPlayer>
export type Round = s.InferOutput<typeof Round>
export type Match = s.InferOutput<typeof Match>
export type Team = s.InferOutput<typeof Team>
export type League = s.InferOutput<typeof League>
export type ChampionshipMatches = s.InferOutput<typeof ChampionshipMatches>
export type Tip = s.InferOutput<typeof Tip>
export type CurrentTipsMatch = s.InferOutput<typeof CurrentTipsMatch>
export type ChampionshipPlayerTips = s.InferOutput<typeof ChampionshipPlayerTips>
export type ChampionshipMatchTips = s.InferOutput<typeof ChampionshipMatchTips>
