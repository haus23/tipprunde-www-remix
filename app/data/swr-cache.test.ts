import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { SwrCache } from './swr-cache.ts'

function setup() {
  let time = 1_000_000
  let cache = new SwrCache({ freshMs: 100, staleMs: 1_000, errorGraceMs: 5_000, maxEntries: 3, now: () => time })
  let calls = 0
  let load = async () => `v${++calls}`
  return {
    cache,
    load,
    get calls() {
      return calls
    },
    advance(ms: number) {
      time += ms
    },
  }
}

describe('SwrCache', () => {
  it('serves fresh values without reloading', async () => {
    let t = setup()
    assert.equal((await t.cache.get('k', t.load, { allowStale: true })).value, 'v1')
    t.advance(100)
    assert.equal((await t.cache.get('k', t.load, { allowStale: true })).value, 'v1')
    assert.equal(t.calls, 1)
  })

  it('serves stale values and refreshes in the background', async () => {
    let t = setup()
    await t.cache.get('k', t.load, { allowStale: true })
    t.advance(500)
    let background: Promise<unknown>[] = []
    let stale = await t.cache.get('k', t.load, { allowStale: true, waitUntil: (p) => background.push(p) })
    assert.equal(stale.value, 'v1')
    assert.equal(stale.revalidating, true)
    assert.equal(background.length, 1)
    await Promise.all(background)
    assert.equal((await t.cache.get('k', t.load, { allowStale: true })).value, 'v2')
  })

  it('waits for fresh data when stale data is not allowed (background revalidation)', async () => {
    let t = setup()
    await t.cache.get('k', t.load, { allowStale: true })
    t.advance(500)
    let result = await t.cache.get('k', t.load, { allowStale: false })
    assert.equal(result.value, 'v2')
    assert.equal(result.revalidating, false)
  })

  it('waits when data is older than the stale window', async () => {
    let t = setup()
    await t.cache.get('k', t.load, { allowStale: true })
    t.advance(2_000)
    assert.equal((await t.cache.get('k', t.load, { allowStale: true })).value, 'v2')
  })

  it('de-duplicates concurrent loads', async () => {
    let t = setup()
    let [a, b] = await Promise.all([
      t.cache.get('k', t.load, { allowStale: true }),
      t.cache.get('k', t.load, { allowStale: true }),
    ])
    assert.equal(a.value, 'v1')
    assert.equal(b.value, 'v1')
    assert.equal(t.calls, 1)
  })

  it('serves older data flagged as degraded when a refresh fails', async () => {
    let t = setup()
    await t.cache.get('k', t.load, { allowStale: true })
    t.advance(2_000)
    let failing = async () => {
      throw new Error('offline')
    }
    let result = await t.cache.get('k', failing, { allowStale: true })
    assert.equal(result.value, 'v1')
    assert.equal(result.degraded, true)
  })

  it('does not hide definitive errors behind old data', async () => {
    let t = setup()
    await t.cache.get('k', t.load, { allowStale: true })
    t.advance(2_000)
    let notFound = Object.assign(new Error('gone'), { recoverable: false })
    await assert.rejects(t.cache.get('k', async () => Promise.reject(notFound), { allowStale: true }), /gone/)
  })

  it('does not cache failures without a previous value', async () => {
    let t = setup()
    await assert.rejects(t.cache.get('k', async () => Promise.reject(new Error('x')), { allowStale: true }))
    assert.equal(t.cache.size, 0)
    assert.equal((await t.cache.get('k', t.load, { allowStale: true })).value, 'v1')
  })

  it('evicts the least recently used entries', async () => {
    let t = setup()
    for (let key of ['a', 'b', 'c', 'd']) await t.cache.get(key, t.load, { allowStale: true })
    assert.equal(t.cache.size, 3)
    await t.cache.get('a', t.load, { allowStale: true })
    assert.equal(t.calls, 5)
  })
})
