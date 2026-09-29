/**
 * Cloudflare Worker entry (ES module worker with a standard `fetch` handler).
 *
 * Static files (fingerprinted browser modules in /assets, favicon) are served
 * by Workers static assets before this code runs; every other request goes
 * through the same Remix router as in development.
 */
import manifest from 'virtual:tipprunde-assets'

import { registerWaitUntil } from '../app/lifetime.ts'
import { createAppRouter } from '../app/router.tsx'
import { createManifestAssets } from './manifest-assets.ts'

interface Env {
  /** Base URL of the read-only API, e.g. https://unterbau.runde.tips/api/v1 */
  UNTERBAU_API_URL?: string
}

/** The subset of the Workers `ExecutionContext` used here. */
interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void
}

let router: ReturnType<typeof createAppRouter> | undefined

export default {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    router ??= createAppRouter({
      assets: createManifestAssets(manifest),
      api: { baseUrl: env.UNTERBAU_API_URL || undefined },
      onError: (error) => console.error(error),
    })
    // Lets the SWR cache finish background refreshes after the response.
    registerWaitUntil(request, (promise) => ctx.waitUntil(promise))
    try {
      return await router.fetch(request)
    } catch (error) {
      if (request.signal.aborted) return new Response(null, { status: 499 })
      console.error(error)
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }
  },
}
