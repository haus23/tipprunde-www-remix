import type { Middleware } from 'remix/router'

/**
 * Cache policy for HTML responses.
 *
 * Pages always carry live data, so browsers and intermediaries must revalidate
 * them on every use (`no-cache`). A weak ETag over the rendered page lets
 * those revalidations end in a cheap `304 Not Modified`. It ignores the
 * per-render hydration ids of Remix UI (`h` + 8 hex digits), which differ on
 * every render without changing what the page shows. Error pages are never
 * stored. Fingerprinted assets are cached separately (see public/_headers).
 */
export function httpCache(): Middleware {
  return async (context, next) => {
    let response = await next()
    if (!isHtml(response) || (context.method !== 'GET' && context.method !== 'HEAD')) return response

    let headers = new Headers(response.headers)
    if (response.status !== 200) {
      headers.set('Cache-Control', 'no-store')
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
    }

    let body = await response.arrayBuffer()
    let etag = `W/"${await digest(body)}"`
    headers.set('Cache-Control', 'no-cache')
    headers.set('ETag', etag)

    if (matchesEtag(context.headers.get('If-None-Match'), etag)) {
      headers.delete('Content-Type')
      headers.delete('Content-Length')
      return new Response(null, { status: 304, headers })
    }
    return new Response(context.method === 'HEAD' ? null : body, { status: 200, headers })
  }
}

function isHtml(response: Response) {
  return response.headers.get('Content-Type')?.toLowerCase().startsWith('text/html') ?? false
}

const HYDRATION_ID = /\bh[0-9a-f]{8}\b/g

async function digest(bytes: ArrayBuffer) {
  let normalized = new TextEncoder().encode(new TextDecoder().decode(bytes).replace(HYDRATION_ID, 'h'))
  let hash = new Uint8Array(await crypto.subtle.digest('SHA-256', normalized))
  let hex = ''
  for (let byte of hash.subarray(0, 12)) hex += byte.toString(16).padStart(2, '0')
  return hex
}

/** Weak comparison as required for `If-None-Match` (RFC 9110, 13.1.2). */
function matchesEtag(header: string | null, etag: string) {
  if (!header) return false
  let opaque = etag.replace(/^W\//, '')
  return header.split(',').some((value) => {
    let candidate = value.trim()
    return candidate === '*' || candidate.replace(/^W\//, '') === opaque
  })
}
