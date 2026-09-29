/**
 * Browser runtime entry. Hydrates the few client entries on the page and
 * enables Remix frame navigation (same-origin links and GET forms update the
 * document in place instead of reloading it).
 */
import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { run, type ResolveFrameOptions } from 'remix/ui'

import { freshness, REVALIDATE_HEADER } from '../../ui/public/freshness.ts'

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await importModule(moduleUrl)
    let Component = mod[exportName]
    if (typeof Component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads
    preloadShim(preloads)
    return []
  },
  // Same as the default resolver, plus the revalidation header for
  // background reloads (see ../../ui/public/freshness.ts).
  async resolveFrame(src, options) {
    let headers = new Headers({ Accept: 'text/html', 'X-Remix-Frame': 'true' })
    if (options?.target != null) headers.set('X-Remix-Target', options.target)
    if (freshness.takeRevalidationFlag()) headers.set(REVALIDATE_HEADER, '1')

    let response = await fetch(src, {
      body: getRequestBody(options),
      headers,
      method: options?.method,
      mode: 'same-origin',
      signal: options?.signal,
    })

    let isHtml = response.headers.get('Content-Type')?.toLowerCase().includes('text/html')
    if (response.status >= 500 && !isHtml) {
      throw new Error(`Failed to resolve frame: ${response.status} ${response.statusText}`.trimEnd())
    }
    if (response.status >= 300 && response.status < 500 && !isHtml) {
      throw new Error(`Failed to resolve frame: ${response.status} ${response.statusText}`.trimEnd())
    }
    // Our error pages (404, 502/503) are complete, helpful HTML documents:
    // render them like any other page.
    return response
  },
})

app.addEventListener('error', (event) => {
  console.error('Tipprunde runtime error', event.error)
  freshness.update({ failed: true, revalidating: false })
})

function getRequestBody(options?: ResolveFrameOptions): BodyInit | undefined {
  let formData = options?.formData
  let method = options?.method
  if (!formData || !method || ['get', 'head'].includes(method.toLowerCase())) return
  if (options?.encType !== 'application/x-www-form-urlencoded') return formData
  let body = new URLSearchParams()
  for (let [name, value] of formData) body.append(name, typeof value === 'string' ? value : value.name)
  return body
}

await app.ready()
