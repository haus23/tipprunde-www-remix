import { createContextKey, type Middleware } from 'remix/router'

import { Unterbau, type UnterbauOptions } from '../data/unterbau.ts'
import { getWaitUntil } from '../lifetime.ts'

/** Sent by the browser for background reloads that should wait for fresh data. */
export const REVALIDATE_HEADER = 'X-Tipprunde-Revalidate'

export const Api = createContextKey<Unterbau>()

export type UnterbauMiddlewareOptions = Pick<UnterbauOptions, 'baseUrl' | 'fetch' | 'cache'>

/**
 * Provides a request-scoped, read-only Unterbau client as `context.api`.
 *
 * Ordinary navigations may be answered from stale cache entries (refreshed in
 * the background). Background revalidation requests from the browser carry
 * {@link REVALIDATE_HEADER} and always receive data within the freshness window.
 */
export function unterbau(
  options: UnterbauMiddlewareOptions = {},
): Middleware<{ key: typeof Api; value: Unterbau; property: 'api' }> {
  return (context, next) => {
    let api = new Unterbau({
      ...options,
      mode: context.request.headers.get(REVALIDATE_HEADER) === '1' ? 'revalidate' : 'navigate',
      waitUntil: getWaitUntil(context.request),
    })
    context.set(Api, api, { property: 'api' })
    return next()
  }
}
