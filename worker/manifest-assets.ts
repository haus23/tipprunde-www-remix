import type { AppAssets, ScriptEntry } from '../app/assets.ts'

export interface AssetManifest {
  /** Script entries keyed by project-relative source path, e.g. `app/ui/public/app-status.tsx`. */
  entries: Record<string, ScriptEntry>
  /** Key of the browser runtime entry. */
  entry: string
}

/**
 * Resolves script entries from the manifest written by `scripts/build.ts`.
 *
 * In the Worker bundle every `import.meta.url` inside `app/**∕public/**` is
 * replaced with `file:///<project-relative path>` (see the esbuild plugin in
 * scripts/build.ts), so `clientEntry()` ids map directly onto manifest keys.
 */
export function createManifestAssets(manifest: AssetManifest): AppAssets {
  let entry = manifest.entries[manifest.entry]
  if (!entry) throw new Error(`Asset manifest is missing the runtime entry ${manifest.entry}`)
  return {
    entry,
    async getScriptEntry(entryId) {
      let key = new URL(entryId).pathname.replace(/^\/+/, '')
      let found = manifest.entries[key]
      if (!found) throw new Error(`No prebuilt client entry for ${key}. Run the production build again.`)
      return found
    },
  }
}
