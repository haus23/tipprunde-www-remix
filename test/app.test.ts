/**
 * End-to-end tests of the request pipeline against a fake Unterbau API:
 * routing, championship/player/match selection, empty states, error handling
 * and the rendered tip states.
 */
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import type { AppAssets } from '../app/assets.ts'
import type { CurrentTipsMatch } from '../app/data/schemas.ts'
import { SwrCache } from '../app/data/swr-cache.ts'
import { createAppRouter } from '../app/router.tsx'
import {
  championship,
  currentTipsMatch,
  match,
  matchesPayload,
  player,
  tip,
} from './fixtures.ts'

const entry = { href: '/assets/entry.js', importMap: { imports: {} }, preloads: [] }
const assets: AppAssets = { entry, getScriptEntry: async () => entry }

// hr2627: running, extra points unpublished.  wm2026: completed, published.
// em2000: no participants and no matches.  ab1999: unranked participants, no evaluated match.
const CHAMPIONSHIPS = [
  championship({ id: 'wm2026', name: 'WM 2026', nr: 60, completed: true, extraPointsPublished: true }),
  championship({ id: 'hr2627', name: 'Hinrunde 2026/27', nr: 61 }),
  championship({ id: 'em2000', name: 'EM 2000', nr: 3, completed: true }),
  championship({ id: 'ab1999', name: 'Testrunde', nr: 2 }),
]

const HR_PLAYERS = [
  player('duschi', { id: 'P-duschi', nr: 1, rank: 2, points: 30, extraPoints: 99, totalPoints: 30 }),
  player('tom', { id: 'P-tom', nr: 2, rank: 1, points: 39, extraPoints: 0, totalPoints: 39 }),
  player('anna', { id: 'P-anna', nr: 3, rank: 1, points: 39, extraPoints: 7, totalPoints: 39 }),
]

const HR_MATCHES = matchesPayload([
  match(1, { id: 'M1', date: '2026-04-26', result: '1:0', points: 3 }),
  match(2, { id: 'M2', date: '2026-04-27', result: '2:2', points: 0 }),
  match(3, { id: 'M3', date: '2026-04-24', result: '0:1', points: 1 }),
  match(4, { id: 'M4', date: '2026-05-01', result: '', hometeamId: '', awayteamId: 'bayern' }),
])

const MATCH_TIPS: Record<string, unknown> = {
  // Keyed by participation id.
  M1: {
    matchId: 'M1',
    tips: {
      'P-tom': tip('P-tom', 'M1', { tip: '1:0', points: 6, joker: true }),
      'P-duschi': tip('P-duschi', 'M1', { tip: '0:0', points: 0 }),
    },
  },
  M2: { matchId: 'M2', tips: { 'P-anna': tip('P-anna', 'M2', { tip: '2:2' }) } },
  M3: { matchId: 'M3', tips: {} },
  M4: { matchId: 'M4', tips: {} },
}

function createApi({ freshMs = 0 } = {}) {
  let requests: string[] = []
  let failing = new Set<string>()
  let fetch = async (input: RequestInfo | URL) => {
    let url = new URL(String(input))
    let path = url.pathname.replace('/api/v1', '') + url.search
    requests.push(path)
    if (failing.has(url.pathname.replace('/api/v1', ''))) return Response.json({ status: 500, error: 'boom' }, { status: 500 })

    let m = /^\/championships\/(\w+)\/([\w-]+)$/.exec(url.pathname.replace('/api/v1', ''))
    if (url.pathname.endsWith('/championships')) return Response.json(CHAMPIONSHIPS)
    if (!m) return Response.json({ status: 404, error: 'nope' }, { status: 404 })
    let [, id, endpoint] = m
    let data: Record<string, Record<string, unknown>> = {
      hr2627: {
        players: HR_PLAYERS,
        matches: HR_MATCHES,
        'current-tips': [
          currentTipsMatch(1, { matchId: 'M1', result: '1:0', tips: (MATCH_TIPS.M1 as { tips: CurrentTipsMatch['tips'] }).tips }),
          currentTipsMatch(4, { matchId: 'M4', hometeam: '', awayteam: 'Bayern' }),
        ],
      },
      wm2026: { players: HR_PLAYERS, matches: HR_MATCHES, 'current-tips': [] },
      em2000: { players: [], matches: matchesPayload([], []), 'current-tips': [] },
      ab1999: {
        players: [player('carla', { id: 'P-carla' }), player('ben', { id: 'P-ben' })],
        matches: matchesPayload([match(5, { id: 'M5' }), match(2, { id: 'M2x' })]),
        'current-tips': [],
      },
    }
    let championshipData = data[id!]
    if (!championshipData) return Response.json({ status: 404, error: 'Championship not found' }, { status: 404 })
    if (endpoint === 'player-tips') {
      let name = url.searchParams.get('name')
      let p = (championshipData.players as ReturnType<typeof player>[]).find((x) => x.playerId === name)
      if (!p) return Response.json({ status: 406, error: 'Unknown account' }, { status: 406 })
      let tips = p.id === 'P-tom' ? { M1: tip('P-tom', 'M1', { tip: '1:0', points: 6, joker: true }) } : {}
      return Response.json({ playerId: p.id, tips })
    }
    if (endpoint === 'match-tips') {
      let nr = Number(url.searchParams.get('nr'))
      let found = (championshipData.matches as typeof HR_MATCHES).matches.find((x) => x.nr === nr)
      if (!found) return Response.json({ status: 404, error: 'No match' }, { status: 404 })
      return Response.json(MATCH_TIPS[found.id] ?? { matchId: found.id, tips: {} })
    }
    return Response.json(championshipData[endpoint!])
  }
  let errors: unknown[] = []
  let router = createAppRouter({
    assets,
    api: { baseUrl: 'https://api.test/api/v1', fetch, cache: new SwrCache({ freshMs, staleMs: freshMs, errorGraceMs: 0, maxEntries: 50 }) },
    onError: (error) => errors.push(error),
  })
  return {
    requests,
    failing,
    errors,
    async get(path: string, headers?: HeadersInit) {
      let response = await router.fetch(new Request(new URL(path, 'http://localhost'), { headers }))
      return { response, html: response.status === 304 ? '' : await response.text() }
    },
  }
}

/** Visible text of the main content (tags stripped, whitespace collapsed). */
function text(html: string) {
  let main = /<main[\s\S]*<\/main>/.exec(html)?.[0] ?? html
  return main
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

describe('routes and championship resolution', () => {
  it('serves all six route variants', async () => {
    let api = createApi()
    for (let path of ['/', '/spieler', '/spiel', '/wm2026', '/wm2026/spieler', '/wm2026/spiel']) {
      let { response } = await api.get(path)
      assert.equal(response.status, 200, path)
      assert.match(response.headers.get('Content-Type') ?? '', /text\/html/)
    }
  })

  it('shows the current championship (highest nr) at /', async () => {
    let { html } = await createApi().get('/')
    assert.match(html, /<title>Aktuelle Tabelle · Hinrunde 2026\/27 · runde\.tips<\/title>/)
  })

  it('resolves a slug and answers unknown slugs with 404', async () => {
    let api = createApi()
    assert.match((await api.get('/wm2026')).html, /Abschlusstabelle · WM 2026/)
    let missing = await api.get('/zz0000/spiel')
    assert.equal(missing.response.status, 404)
    assert.match(missing.html, /Dieses Turnier gibt es nicht/)
    assert.ok(!api.requests.some((r) => r.includes('zz0000')), 'no detail request for unknown slug')
  })

  it('renders a 404 page for unknown paths', async () => {
    let { response, html } = await createApi().get('/a/b/c')
    assert.equal(response.status, 404)
    assert.match(html, /Hoppla/)
  })

  it('keeps links inside the URL family of the page', async () => {
    let api = createApi()
    let current = (await api.get('/')).html
    assert.match(current, /href="\/spieler\?name=tom"/)
    assert.match(current, /href="\/spiel\?nr=1"/)
    let slug = (await api.get('/wm2026')).html
    assert.match(slug, /href="\/wm2026\/spieler\?name=tom"/)
  })

  it('switches championships without carrying selections over', async () => {
    let { html } = await createApi().get('/wm2026/spiel?nr=2')
    assert.match(html, /href="\/spiel"/) // current championship: short URL, no ?nr
    assert.match(html, /href="\/em2000\/spiel"/)
    assert.doesNotMatch(html, /href="\/em2000\/spiel\?nr/)
  })
})

describe('ranking', () => {
  it('keeps shared ranks from the API and suppresses repeated numbers only visually', async () => {
    let body = text((await createApi().get('/')).html)
    // Order and ranks as delivered: duschi 2, tom 1, anna 1 (tom follows a different rank).
    assert.match(body, /2\. Duschi 30 .* 1\. Tom 39 .* 1\. Anna 39/)
    let html = (await createApi().get('/')).html
    assert.match(html, /<span class="sr-only">1\.<\/span>/)
  })

  it('never reveals unpublished extra points', async () => {
    let html = (await createApi().get('/')).html
    assert.doesNotMatch(html, /Zusatz/)
    assert.doesNotMatch(text(html), /\b99\b/)
  })

  it('shows published extra points and totals for completed championships', async () => {
    let html = (await createApi().get('/wm2026')).html
    assert.match(html, /Zusatzpunkte/)
    assert.match(text(html), /Gesamt/)
    assert.match(text(html), /\b99\b/)
  })

  it('shows current tips keyed by participation id for running championships', async () => {
    let api = createApi()
    let body = text((await api.get('/')).html)
    assert.match(body, /Tom 39 1:0 .*Joker.* 6/)
    assert.match(body, /Anna 39 kein Tipp 0/)
    assert.ok(api.requests.includes('/championships/hr2627/current-tips'))
    let completed = createApi()
    await completed.get('/wm2026')
    assert.ok(!completed.requests.some((r) => r.includes('current-tips')), 'no current tips for completed')
  })

  it('handles championships without participants or ranking', async () => {
    assert.match(text((await createApi().get('/em2000')).html), /Noch keine Teilnehmer/)
    let unranked = text((await createApi().get('/ab1999')).html)
    assert.match(unranked, /Teilnehmer/)
    assert.match(unranked, /Noch keine Wertung/)
  })

  it('degrades gracefully when current tips fail', async () => {
    let api = createApi()
    api.failing.add('/championships/hr2627/current-tips')
    let { response, html } = await api.get('/')
    assert.equal(response.status, 200)
    assert.match(text(html), /aktuellen Tipps konnten nicht geladen werden/)
  })
})

describe('players view', () => {
  it('defaults to the table leader and asks player-tips for the member id', async () => {
    let api = createApi()
    let { html } = await api.get('/spieler')
    assert.match(html, /Tipps von Tom/)
    assert.ok(api.requests.includes('/championships/hr2627/player-tips?name=tom'))
  })

  it('selects ?name= by member id and falls back for unknown values', async () => {
    let api = createApi()
    assert.match((await api.get('/spieler?name=anna')).html, /Tipps von Anna/)
    assert.match((await api.get('/spieler?name=P-anna')).html, /Tipps von Tom/)
    assert.match((await api.get('/spieler?name=nobody')).html, /Tipps von Tom/)
    assert.ok(!api.requests.some((r) => r.includes('name=P-anna') || r.includes('name=nobody')))
  })

  it('uses the first API participant without ranking', async () => {
    assert.match((await createApi().get('/ab1999/spieler')).html, /Tipps von Carla/)
  })

  it('computes the average from regular points over evaluated matches', async () => {
    let body = text((await createApi().get('/spieler?name=tom')).html)
    // 39 points / 3 evaluated matches
    assert.match(body, /Spiele 3 von 4/)
    assert.match(body, /Schnitt 13,00/)
  })

  it('shows an empty state without participants and never calls player-tips', async () => {
    let api = createApi()
    assert.match(text((await api.get('/em2000/spieler')).html), /Noch keine Teilnehmer/)
    assert.ok(!api.requests.some((r) => r.includes('player-tips')))
  })
})

describe('matches view', () => {
  it('defaults to the chronologically last evaluated match', async () => {
    let { html } = await createApi().get('/spiel')
    assert.match(html, /<title>Spiel 2:/)
  })

  it('selects ?nr= and falls back for invalid or unknown numbers', async () => {
    let api = createApi()
    assert.match((await api.get('/spiel?nr=4')).html, /<title>Spiel 4:/)
    for (let value of ['99', 'abc', '0', '-1']) {
      assert.match((await api.get(`/spiel?nr=${value}`)).html, /<title>Spiel 2:/, value)
    }
    assert.ok(!api.requests.some((r) => /nr=(99|abc|0|-1)$/.test(r)))
  })

  it('offers prev/next only where neighbours exist', async () => {
    let api = createApi()
    let first = (await api.get('/spiel?nr=1')).html
    assert.doesNotMatch(first, /rel="prev"/)
    assert.match(first, /rel="next"[^>]*|href="\/spiel\?nr=2"/)
    let last = (await api.get('/spiel?nr=4')).html
    assert.doesNotMatch(last, /rel="next"/)
    assert.match(last, /href="\/spiel\?nr=3"/)
  })

  it('distinguishes missing tip, zero-point tip and uncalculated points', async () => {
    let api = createApi()
    let m1 = text((await api.get('/spiel?nr=1')).html)
    assert.match(m1, /Duschi 0:0 0/) // submitted, 0 points
    assert.match(m1, /Tom 1:0 .*Joker.* 6/)
    assert.match(m1, /Anna kein Tipp 0/) // no tip on an evaluated match
    let m2 = text((await api.get('/spiel?nr=2')).html)
    assert.match(m2, /Anna 2:2 – nicht berechnet/)
  })

  it('does not show points for unevaluated matches and handles open teams', async () => {
    let body = text((await createApi().get('/spiel?nr=4')).html)
    assert.match(body, /offen – gegen FC Bayern München/)
    assert.match(body, /noch nicht gewertet/)
    assert.doesNotMatch(body, /Tom – kein Tipp 0/)
  })

  it('links players with their member id', async () => {
    let html = (await createApi().get('/wm2026/spiel?nr=1')).html
    assert.match(html, /href="\/wm2026\/spieler\?name=tom"/)
    assert.doesNotMatch(html, /name=P-tom/)
  })

  it('uses the smallest nr without evaluated matches and handles no matches', async () => {
    let api = createApi()
    assert.match((await api.get('/ab1999/spiel')).html, /<title>Spiel 2:/)
    assert.match(text((await api.get('/em2000/spiel')).html), /Noch keine Spiele/)
    assert.ok(!api.requests.some((r) => r.startsWith('/championships/em2000/match-tips')))
  })
})

describe('errors and HTTP caching', () => {
  it('renders a 503 page when the API is unavailable', async () => {
    let api = createApi()
    api.failing.add('/championships')
    let { response, html } = await api.get('/')
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.match(html, /nicht erreichbar/)
    assert.equal(api.errors.length, 1)
  })

  it('marks pages no-cache with an ETag and answers conditional requests with 304', async () => {
    let api = createApi({ freshMs: 60_000 })
    let first = await api.get('/wm2026')
    assert.equal(first.response.headers.get('Cache-Control'), 'no-cache')
    let etag = first.response.headers.get('ETag')
    assert.ok(etag)
    let second = await api.get('/wm2026', { 'If-None-Match': etag! })
    assert.equal(second.response.status, 304)
  })

  it('never renders email addresses', async () => {
    let html = (await createApi().get('/')).html
    assert.doesNotMatch(html, /@[a-z0-9-]+\.[a-z]/i)
  })
})
