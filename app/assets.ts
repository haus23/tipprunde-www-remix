import { createContextKey, type Middleware } from 'remix/router'

/** Browser module metadata for one script entry, as produced by `remix/assets`. */
export interface ScriptEntry {
  href: string
  importMap: { imports: Record<string, string> }
  preloads: string[]
}

/**
 * The runtime-specific way to reach browser assets.
 *
 * - Node development: `server/dev-assets.ts` compiles `app/**∕public/**` on demand
 *   with `remix/assets`.
 * - Cloudflare Worker: `worker/manifest-assets.ts` resolves the same ids from a
 *   manifest written at build time; the files themselves are Workers static assets.
 */
export interface AppAssets {
  /** The browser runtime entry (`app/actions/public/entry.ts`). */
  entry: ScriptEntry
  /** Resolves a `clientEntry(import.meta.url, …)` id. Used by `render({ assets })`. */
  getScriptEntry(entryId: string): Promise<ScriptEntry>
  /** Serves `/assets/*` when the runtime has no static asset layer in front of the app. */
  fetch?(request: Request): Promise<Response | null>
}

export const ENTRY_SOURCE = 'app/actions/public/entry.ts'

export const Assets = createContextKey<AppAssets>()

export function provideAssets(
  assets: AppAssets,
): Middleware<{ key: typeof Assets; value: AppAssets; property: 'assets' }> {
  return (context, next) => {
    context.set(Assets, assets, { property: 'assets' })
    return next()
  }
}
