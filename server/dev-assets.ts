/**
 * Node-only asset integration for local development: compiles browser source
 * on demand with `remix/assets`, configured from `remix.json`.
 */
import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { loadConfig } from 'remix/cli'

import { ENTRY_SOURCE, type AppAssets } from '../app/assets.ts'

export async function createDevAssets(): Promise<AppAssets & { close(): Promise<void> }> {
  let rootDir = path.resolve(import.meta.dirname, '..')
  let config = await loadConfig(rootDir)
  if (config.assets === undefined) throw new Error('remix.json is missing the "assets" section')

  let server = createAssetServer({
    ...config.assets,
    sourceMaps: 'external',
    watch: true,
  })

  return {
    entry: await server.getScriptEntry(path.join(rootDir, ENTRY_SOURCE)),
    getScriptEntry: (entryId) => server.getScriptEntry(entryId),
    fetch: (request) => server.fetch(request),
    close: () => server.close(),
  }
}
