/**
 * A small in-memory stale-while-revalidate cache for API responses.
 *
 * One instance lives per server process / Worker isolate. It deliberately
 * keeps data only briefly so the Unterbau's own cache stays authoritative:
 *
 * - `age <= freshMs`: served as is.
 * - `freshMs < age <= staleMs`: served immediately, refreshed in the background
 *   (only when the caller allows stale data, e.g. ordinary navigations).
 * - otherwise: the caller waits for a fresh response.
 * - if a refresh fails, data up to `errorGraceMs` old is served and flagged as
 *   degraded instead of failing the whole page.
 *
 * Concurrent loads of the same key are de-duplicated.
 */

export interface SwrCacheOptions {
  freshMs: number
  staleMs: number
  errorGraceMs: number
  maxEntries: number
  now?: () => number
}

export interface CacheReadOptions {
  /** Allow serving data older than `freshMs` while refreshing in the background. */
  allowStale: boolean
  /** Keeps background refreshes alive after the response is sent (Workers `ctx.waitUntil`). */
  waitUntil?: (promise: Promise<unknown>) => void
}

export interface CacheResult<T> {
  value: T
  /** Epoch milliseconds of the upstream response the value came from. */
  fetchedAt: number
  /** The value is older than `freshMs`; a background refresh has been started. */
  revalidating: boolean
  /** The latest refresh failed and an older value is served instead. */
  degraded: boolean
}

interface Entry {
  value?: unknown
  fetchedAt: number
  hasValue: boolean
  pending?: Promise<unknown>
}

export class SwrCache {
  #options: Required<SwrCacheOptions>
  #entries = new Map<string, Entry>()

  constructor(options: SwrCacheOptions) {
    this.#options = { now: Date.now, ...options }
  }

  get size() {
    return this.#entries.size
  }

  clear() {
    this.#entries.clear()
  }

  async get<T>(key: string, load: () => Promise<T>, options: CacheReadOptions): Promise<CacheResult<T>> {
    let { freshMs, staleMs, errorGraceMs, now } = this.#options
    let entry = this.#entries.get(key)
    let time = now()

    if (entry?.hasValue) {
      let age = time - entry.fetchedAt
      if (age <= freshMs) {
        this.#touch(key, entry)
        return { value: entry.value as T, fetchedAt: entry.fetchedAt, revalidating: false, degraded: false }
      }
      if (options.allowStale && age <= staleMs) {
        let refresh = this.#refresh(key, load).catch(() => {
          // Keep serving the previous value; the next request retries.
        })
        options.waitUntil?.(refresh)
        this.#touch(key, entry)
        return { value: entry.value as T, fetchedAt: entry.fetchedAt, revalidating: true, degraded: false }
      }
    }

    try {
      let value = (await this.#refresh(key, load)) as T
      let current = this.#entries.get(key)!
      return { value, fetchedAt: current.fetchedAt, revalidating: false, degraded: false }
    } catch (error) {
      let fallback = this.#entries.get(key)
      if (fallback?.hasValue && now() - fallback.fetchedAt <= errorGraceMs && isRecoverable(error)) {
        return { value: fallback.value as T, fetchedAt: fallback.fetchedAt, revalidating: false, degraded: true }
      }
      throw error
    }
  }

  #refresh(key: string, load: () => Promise<unknown>): Promise<unknown> {
    let entry = this.#entries.get(key)
    if (entry?.pending) return entry.pending

    let pending = load().then(
      (value) => {
        this.#touch(key, { value, fetchedAt: this.#options.now(), hasValue: true })
        return value
      },
      (error: unknown) => {
        let current = this.#entries.get(key)
        if (current) {
          delete current.pending
          if (!current.hasValue) this.#entries.delete(key)
        }
        throw error
      },
    )

    if (entry) {
      entry.pending = pending
    } else {
      this.#touch(key, { fetchedAt: 0, hasValue: false, pending })
    }
    return pending
  }

  #touch(key: string, entry: Entry) {
    this.#entries.delete(key)
    this.#entries.set(key, entry)
    while (this.#entries.size > this.#options.maxEntries) {
      let oldest = this.#entries.keys().next().value
      if (oldest === undefined) break
      this.#entries.delete(oldest)
    }
  }
}

/** Definitive answers (e.g. 404) must not be hidden behind old data. */
function isRecoverable(error: unknown) {
  if (typeof error === 'object' && error !== null && 'recoverable' in error) {
    return Boolean((error as { recoverable: unknown }).recoverable)
  }
  return true
}
