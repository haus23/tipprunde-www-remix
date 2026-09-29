/**
 * Read-only client for the public Unterbau API.
 *
 * - Only `GET` requests against `/api/v1` — no writes, no cache invalidation.
 * - Every response is status-checked and schema-validated.
 * - Responses go through the shared {@link SwrCache}; the per-request
 *   {@link Unterbau} instance records how fresh the data behind a page is.
 */
import * as s from 'remix/data-schema'

import * as schema from './schemas.ts'
import { SwrCache, type CacheResult } from './swr-cache.ts'

export const DEFAULT_API_BASE_URL = 'https://unterbau.runde.tips/api/v1'

/** Freshness policy, see docs/architecture.md ("Daten und Caching"). */
export const FRESH_MS = 15_000
export const STALE_MS = 5 * 60_000
export const ERROR_GRACE_MS = 60 * 60_000
const REQUEST_TIMEOUT_MS = 8_000

export type ApiErrorKind = 'http' | 'network' | 'invalid'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  /** Upstream HTTP status, `0` when no response arrived. */
  readonly status: number
  readonly path: string

  constructor(kind: ApiErrorKind, status: number, path: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.path = path
  }

  /** Transient failures may fall back to older cached data. */
  get recoverable() {
    return this.kind !== 'http' || this.status >= 500
  }
}

export const sharedCache = new SwrCache({
  freshMs: FRESH_MS,
  staleMs: STALE_MS,
  errorGraceMs: ERROR_GRACE_MS,
  maxEntries: 500,
})

export interface UnterbauOptions {
  baseUrl?: string
  fetch?: typeof fetch
  cache?: SwrCache
  /**
   * `navigate`: stale data may be served while refreshing in the background.
   * `revalidate`: the caller (a background reload in the browser) wants data
   * no older than {@link FRESH_MS} and is happy to wait for it.
   */
  mode?: 'navigate' | 'revalidate'
  waitUntil?: (promise: Promise<unknown>) => void
}

export interface DataStatus {
  /** Oldest upstream timestamp of all data used for this response. */
  fetchedAt: number | undefined
  /** At least one value is older than the freshness window. */
  revalidating: boolean
  /** At least one value is served from cache because the API is unreachable. */
  degraded: boolean
}

export class Unterbau {
  readonly status: DataStatus = { fetchedAt: undefined, revalidating: false, degraded: false }
  #baseUrl: string
  #fetch: typeof fetch
  #cache: SwrCache
  #allowStale: boolean
  #waitUntil: ((promise: Promise<unknown>) => void) | undefined

  constructor(options: UnterbauOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? DEFAULT_API_BASE_URL).replace(/\/+$/, '')
    this.#fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init))
    this.#cache = options.cache ?? sharedCache
    this.#allowStale = (options.mode ?? 'navigate') === 'navigate'
    this.#waitUntil = options.waitUntil
  }

  championships() {
    return this.#get('/championships', schema.Championships)
  }

  players(championshipId: string) {
    return this.#get(`/championships/${enc(championshipId)}/players`, schema.ChampionshipPlayers)
  }

  matches(championshipId: string) {
    return this.#get(`/championships/${enc(championshipId)}/matches`, schema.ChampionshipMatches)
  }

  currentTips(championshipId: string) {
    return this.#get(`/championships/${enc(championshipId)}/current-tips`, schema.ChampionshipCurrentTips)
  }

  /** @param accountId `ChampionshipPlayer.playerId` (member id), not the participation id. */
  playerTips(championshipId: string, accountId: string) {
    return this.#get(
      `/championships/${enc(championshipId)}/player-tips?name=${enc(accountId)}`,
      schema.ChampionshipPlayerTips,
    )
  }

  matchTips(championshipId: string, matchNr: number) {
    return this.#get(`/championships/${enc(championshipId)}/match-tips?nr=${matchNr}`, schema.ChampionshipMatchTips)
  }

  async #get<T>(path: string, responseSchema: s.Schema<unknown, T>): Promise<T> {
    let result: CacheResult<T> = await this.#cache.get(path, () => this.#load(path, responseSchema), {
      allowStale: this.#allowStale,
      waitUntil: this.#waitUntil,
    })
    this.status.fetchedAt =
      this.status.fetchedAt === undefined ? result.fetchedAt : Math.min(this.status.fetchedAt, result.fetchedAt)
    this.status.revalidating ||= result.revalidating
    this.status.degraded ||= result.degraded
    return result.value
  }

  async #load<T>(path: string, responseSchema: s.Schema<unknown, T>): Promise<T> {
    let response: Response
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      throw new ApiError('network', 0, path, `Unterbau nicht erreichbar: ${describe(error)}`)
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = undefined
    }

    if (!response.ok) {
      let parsed = s.parseSafe(schema.ApiErrorBody, body)
      let message = parsed.success ? parsed.value.error : response.statusText
      throw new ApiError('http', response.status, path, message || `HTTP ${response.status}`)
    }

    let parsed = s.parseSafe(responseSchema, body)
    if (!parsed.success) {
      let issue = parsed.issues[0]
      let where = issue?.path?.map((p) => (typeof p === 'object' ? String(p.key) : String(p))).join('.')
      throw new ApiError('invalid', response.status, path, `Ungültige API-Antwort (${where || 'root'}: ${issue?.message})`)
    }
    return parsed.value
  }
}

function enc(value: string) {
  return encodeURIComponent(value)
}

function describe(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
