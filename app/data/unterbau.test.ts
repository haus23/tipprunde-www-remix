import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { championships, matchesPayload, match, rankedPlayers } from '../../test/fixtures.ts'
import { SwrCache } from './swr-cache.ts'
import { ApiError, Unterbau } from './unterbau.ts'

function createClient(respond: (url: URL) => Response | Promise<Response>) {
  let requests: URL[] = []
  let client = new Unterbau({
    baseUrl: 'https://api.test/api/v1/',
    cache: new SwrCache({ freshMs: 1_000, staleMs: 1_000, errorGraceMs: 1_000, maxEntries: 10 }),
    fetch: async (input, init) => {
      assert.equal(init?.method ?? 'GET', 'GET')
      let url = new URL(String(input))
      requests.push(url)
      return respond(url)
    },
  })
  return { client, requests }
}

describe('Unterbau client', () => {
  it('requests the documented endpoints and validates responses', async () => {
    let { client, requests } = createClient((url) => {
      if (url.pathname.endsWith('/championships')) return Response.json(championships)
      if (url.pathname.endsWith('/players')) return Response.json(rankedPlayers)
      return Response.json(matchesPayload([match(1, { hometeamId: null as unknown as string })]))
    })
    assert.equal((await client.championships()).length, 3)
    assert.equal((await client.players('hr2627'))[0]?.playerId, 'duschi')
    let matches = await client.matches('hr2627')
    assert.equal(matches.matches[0]?.hometeamId, '')
    assert.deepEqual(
      requests.map((u) => u.pathname),
      ['/api/v1/championships', '/api/v1/championships/hr2627/players', '/api/v1/championships/hr2627/matches'],
    )
    assert.equal(typeof client.status.fetchedAt, 'number')
  })

  it('sends the member id as ?name= for player tips', async () => {
    let { client, requests } = createClient(() => Response.json({ playerId: 'part-tom', tips: {} }))
    let result = await client.playerTips('hr2627', 'tom')
    assert.equal(requests[0]?.searchParams.get('name'), 'tom')
    assert.equal(result.playerId, 'part-tom')
  })

  it('turns documented error statuses into ApiErrors', async () => {
    let { client } = createClient(() => Response.json({ status: 404, error: 'Championship not found' }, { status: 404 }))
    let error = await client.players('xx0000').catch((e: unknown) => e)
    assert.ok(error instanceof ApiError)
    assert.equal(error.kind, 'http')
    assert.equal(error.status, 404)
    assert.equal(error.message, 'Championship not found')
    assert.equal(error.recoverable, false)
  })

  it('rejects responses that violate the contract', async () => {
    let { client } = createClient(() => Response.json([{ id: 'hr2627', name: 'x' }]))
    let error = await client.championships().catch((e: unknown) => e)
    assert.ok(error instanceof ApiError)
    assert.equal(error.kind, 'invalid')
  })

  it('rejects malformed scores', async () => {
    let { client } = createClient(() => Response.json(matchesPayload([match(1, { result: 'drei' })])))
    let error = await client.matches('hr2627').catch((e: unknown) => e)
    assert.ok(error instanceof ApiError && error.kind === 'invalid')
  })

  it('reports network failures', async () => {
    let { client } = createClient(() => Promise.reject(new TypeError('fetch failed')))
    let error = await client.championships().catch((e: unknown) => e)
    assert.ok(error instanceof ApiError)
    assert.equal(error.kind, 'network')
    assert.equal(error.recoverable, true)
  })

  it('never exposes email addresses beyond the parsed account', async () => {
    let { client } = createClient(() => Response.json(rankedPlayers))
    let players = await client.players('hr2627')
    assert.equal(players[0]?.account.email, '')
  })
})
