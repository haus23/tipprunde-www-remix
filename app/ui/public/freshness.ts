/**
 * Browser-side freshness policy, shared by the runtime entry (which owns the
 * frame resolver) and the `AppStatus` client entry (which owns the triggers).
 *
 * Data shown in the page counts as stale after {@link FRESH_MS}. A stale page
 * is reloaded in the background — the visible content stays until the new
 * HTML has arrived and is reconciled in place — when
 *
 * - the tab becomes visible again or the window regains focus,
 * - the network connection comes back (`online`),
 * - the page is restored from the back/forward cache,
 * - and, for running championships only, every {@link POLL_MS} while the tab
 *   is visible and online.
 *
 * Normal navigations always fetch fresh HTML from the server anyway.
 */
import { TypedEventTarget } from 'remix/ui'

export const FRESH_MS = 15_000
export const POLL_MS = 60_000
export const REVALIDATE_HEADER = 'X-Tipprunde-Revalidate'

type FreshnessEvents = {
  change: Event
}

class Freshness extends TypedEventTarget<FreshnessEvents> {
  /** Time of the last successful load of the page content. */
  loadedAt = Date.now()
  revalidating = false
  /** Set when the last navigation or revalidation failed. */
  failed = false
  #nextRequestIsRevalidation = false

  isStale(now = Date.now()) {
    return now - this.loadedAt > FRESH_MS
  }

  /** Called by the frame resolver: does the request it is about to send belong to a revalidation? */
  takeRevalidationFlag() {
    let flag = this.#nextRequestIsRevalidation
    this.#nextRequestIsRevalidation = false
    return flag
  }

  markRevalidationRequest() {
    this.#nextRequestIsRevalidation = true
  }

  update(patch: Partial<Pick<Freshness, 'loadedAt' | 'revalidating' | 'failed'>>) {
    Object.assign(this, patch)
    this.dispatchEvent(new Event('change'))
  }
}

export const freshness = new Freshness()
