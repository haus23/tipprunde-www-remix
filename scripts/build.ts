/**
 * Production build for Cloudflare Workers.
 *
 *   dist/client/        Workers static assets: prebuilt browser modules + public/
 *   dist/worker/index.js  bundled ES module Worker (no Node APIs)
 *
 * Remix 3 compiles browser modules on demand with `remix/assets`, which needs
 * Node (file system, native compilers). A Worker cannot do that, so this script
 * runs the same asset server once at build time and stores its output:
 *
 * 1. `getScriptEntry()` for the runtime entry and every `clientEntry()` module
 *    (fingerprinted, minified) → hrefs, import maps and module preloads.
 * 2. Every referenced module is written to dist/client. Fingerprinted file
 *    names (`name.@hash.ts`) are renamed to `name.hash.js`: Cloudflare would
 *    otherwise redirect `@` to `%40` and serve `.ts` with a non-JS MIME type.
 *    Directories are kept, and only import map *values* change; modules import
 *    the stable URLs (the import map keys, or relative paths resolving to
 *    them), so their contents stay untouched.
 * 3. The resulting manifest is bundled into the Worker as
 *    `virtual:tipprunde-assets`, and `import.meta.url` in `app/**∕public/**`
 *    is replaced with `file:///<project-relative path>` so client entry ids
 *    resolve against it.
 *
 * Verified with remix@3.0.0-rc.4.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as esbuild from 'esbuild'
import { createAssetServer } from 'remix/assets'
import { loadConfig } from 'remix/cli'

import { ENTRY_SOURCE, type ScriptEntry } from '../app/assets.ts'
import type { AssetManifest } from '../worker/manifest-assets.ts'

const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'dist')
const clientDir = path.join(dist, 'client')
const workerFile = path.join(dist, 'worker', 'index.js')

let started = performance.now()
fs.rmSync(dist, { recursive: true, force: true })
fs.mkdirSync(clientDir, { recursive: true })

// --- 1. Browser modules --------------------------------------------------------

let config = await loadConfig(root)
if (config.assets === undefined) throw new Error('remix.json is missing the "assets" section')
let assetServer = createAssetServer({
  ...config.assets,
  fingerprint: true,
  minify: true,
  watch: false,
})

let clientEntrySources = fs
  .globSync('app/**/public/**/*.{ts,tsx}', { cwd: root })
  .map((file) => file.split(path.sep).join('/'))
  .filter((file) => !/\.test\./.test(file))
  .filter((file) => /\bclientEntry\s*\(/.test(fs.readFileSync(path.join(root, file), 'utf8')))
  .sort()

let entries: Record<string, ScriptEntry> = {}
for (let source of [ENTRY_SOURCE, ...clientEntrySources]) {
  entries[source] = await assetServer.getScriptEntry(path.join(root, source))
}

let renamed = new Map<string, string>()
function publicUrl(fingerprinted: string) {
  let existing = renamed.get(fingerprinted)
  if (existing) return existing
  // Only the file name changes. Directories stay as they are (e.g. the
  // encoded `%40remix-run`) so relative imports inside a module still resolve
  // to the stable URLs used as import map keys.
  let match = /^(.*\/)([^/]+)\.(?:@|%40)([\w-]+)\.m?[jt]sx?$/.exec(fingerprinted)
  if (!match) throw new Error(`Unexpected asset URL ${fingerprinted}`)
  let [, dir, name, hash] = match
  let safe = `${dir}${name}.${hash}.js`
  renamed.set(fingerprinted, safe)
  return safe
}

for (let entry of Object.values(entries)) {
  let urls = new Set([entry.href, ...entry.preloads, ...Object.values(entry.importMap.imports)])
  for (let url of urls) publicUrl(url)
}

let clientBytes = 0
for (let [url, safe] of renamed) {
  let response = await assetServer.fetch(new Request(new URL(url, 'http://build.local')))
  if (!response?.ok) throw new Error(`Could not build ${url}: ${response?.status}`)
  let bytes = new Uint8Array(await response.arrayBuffer())
  clientBytes += bytes.length
  let file = path.join(clientDir, decodeURIComponent(safe))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, bytes)
}
await assetServer.close()

let manifest: AssetManifest = { entry: ENTRY_SOURCE, entries: {} }
for (let [source, entry] of Object.entries(entries)) {
  manifest.entries[source] = {
    href: publicUrl(entry.href),
    preloads: entry.preloads.map(publicUrl),
    importMap: {
      imports: Object.fromEntries(Object.entries(entry.importMap.imports).map(([key, value]) => [key, publicUrl(value)])),
    },
  }
}
fs.writeFileSync(path.join(dist, 'asset-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

// Root public/ files and cache headers for Workers static assets.
fs.cpSync(path.join(root, 'public'), clientDir, { recursive: true })
fs.writeFileSync(
  path.join(clientDir, '_headers'),
  [
    '# Fingerprinted browser modules never change.',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '/favicon.svg',
    '  Cache-Control: public, max-age=86400',
    '',
  ].join('\n'),
)

// --- 2. Worker bundle -----------------------------------------------------------

const publicSource = /[\\/]app[\\/](?:.+[\\/])?public[\\/].+\.[mc]?[jt]sx?$/

let result = await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['worker/worker.ts'],
  outfile: workerFile,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2024',
  mainFields: ['module', 'main'],
  conditions: ['workerd', 'worker', 'browser', 'import', 'default'],
  jsx: 'automatic',
  jsxImportSource: 'remix/ui',
  minify: true,
  // clientEntry() falls back to the component function name as export name.
  keepNames: true,
  sourcemap: 'linked',
  legalComments: 'none',
  metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  plugins: [
    {
      name: 'tipprunde-worker',
      setup(build) {
        build.onResolve({ filter: /^virtual:tipprunde-assets$/ }, () => ({
          path: 'asset-manifest',
          namespace: 'tipprunde',
        }))
        build.onLoad({ filter: /.*/, namespace: 'tipprunde' }, () => ({
          contents: JSON.stringify(manifest),
          loader: 'json',
        }))
        // Stable client entry ids: file:///app/ui/public/x.tsx
        build.onLoad({ filter: publicSource }, (args) => {
          let relative = path.relative(root, args.path).split(path.sep).join('/')
          let source = fs.readFileSync(args.path, 'utf8')
          return {
            contents: source.replaceAll('import.meta.url', JSON.stringify(`file:///${relative}`)),
            loader: path.extname(args.path).slice(1) as esbuild.Loader,
          }
        })
      },
    },
  ],
})

let nodeImports = Object.values(result.metafile.inputs).flatMap((input) =>
  input.imports.filter((i) => i.path !== '<runtime>' && (i.path.startsWith('node:') || i.external)).map((i) => i.path),
)
if (nodeImports.length > 0) throw new Error(`Worker bundle imports Node/external modules: ${nodeImports.join(', ')}`)

let workerBytes = fs.statSync(workerFile).size
let kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`
console.log(`client  ${renamed.size} modules, ${kb(clientBytes)} (minified, before compression)`)
console.log(`entries ${Object.keys(entries).join(', ')}`)
console.log(`worker  ${path.relative(root, workerFile)} ${kb(workerBytes)}`)
console.log(`done in ${Math.round(performance.now() - started)} ms`)
