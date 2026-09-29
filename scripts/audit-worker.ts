/**
 * Checks a built or dry-run Worker bundle for accidental Node.js or React
 * runtime dependencies.
 *
 *   node scripts/audit-worker.ts [dir]   (default: dist/worker)
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

let dir = path.resolve(process.argv[2] ?? 'dist/worker')
let files = fs.globSync('**/*.{js,mjs}', { cwd: dir })
if (files.length === 0) throw new Error(`No JavaScript found in ${dir}`)

let checks: [string, RegExp][] = [
  ['node: import', /\bfrom\s*["']node:|\bimport\(\s*["']node:|\brequire\(\s*["']node:/],
  ['bare Node builtin import', /\bfrom\s*["'](fs|path|http|https|crypto|stream|buffer|url|os|util|events|child_process|worker_threads)["']/],
  ['require()', /\brequire\(\s*["'][^"']+["']\s*\)/],
  ['React', /\bfrom\s*["'](react|react-dom)(\/[^"']*)?["']|__SECRET_INTERNALS|react\.element/],
  ['Remix 2 / React Router', /@remix-run\/(react|node|cloudflare|server-runtime)|react-router/],
  ['process.env', /\bprocess\.env\b/],
]

let problems = 0
for (let file of files) {
  let source = fs.readFileSync(path.join(dir, file), 'utf8')
  for (let [label, pattern] of checks) {
    let match = pattern.exec(source)
    if (match) {
      problems++
      console.error(`✗ ${file}: ${label}: …${source.slice(Math.max(0, match.index - 40), match.index + 60)}…`)
    }
  }
  console.log(`checked ${file} (${(fs.statSync(path.join(dir, file)).size / 1024).toFixed(1)} KiB)`)
}
if (problems > 0) process.exit(1)
console.log('✓ no Node.js, React or Remix 2 runtime dependencies found')
