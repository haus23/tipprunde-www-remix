/**
 * Local development server (Node). Production runs as a Cloudflare Worker,
 * see worker/worker.ts.
 */
import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { createAppRouter } from './app/router.tsx'
import { createDevAssets } from './server/dev-assets.ts'

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100
const assets = await createDevAssets()
const router = createAppRouter({
  assets,
  api: { baseUrl: process.env.UNTERBAU_API_URL },
})
const publicDir = path.resolve(import.meta.dirname, 'public')
const contentTypes: Record<string, string> = { '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' }

// Root public/ files (favicon, robots.txt) are Workers static assets in production.
async function servePublicFile(request: Request): Promise<Response | undefined> {
  let { pathname } = new URL(request.url)
  let type = contentTypes[path.extname(pathname)]
  if (request.method !== 'GET' || !type || pathname.includes('..')) return undefined
  try {
    return new Response(await fs.readFile(path.join(publicDir, pathname)), { headers: { 'Content-Type': type } })
  } catch {
    return undefined
  }
}

const server = http.createServer(
  createRequestListener(async (request) => (await servePublicFile(request)) ?? router.fetch(request)),
)

server.listen(port, () => {
  console.log(`Tipprunde dev server on http://localhost:${port}`)
})

let shuttingDown = false
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  void assets.close()
  server.close(() => process.exit(0))
  server.closeAllConnections()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
