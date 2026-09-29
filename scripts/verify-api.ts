/**
 * Validates every public championship's live Unterbau responses against the
 * app's schemas and prints per-championship facts relevant for the UI.
 *
 *   node scripts/verify-api.ts [baseUrl]
 */
import { describeTip, findCurrentChampionship, defaultMatch, defaultPlayer, hasRanking } from '../app/data/tipprunde.ts'
import { SwrCache } from '../app/data/swr-cache.ts'
import { Unterbau } from '../app/data/unterbau.ts'

let api = new Unterbau({
  baseUrl: process.argv[2],
  cache: new SwrCache({ freshMs: 60_000, staleMs: 60_000, errorGraceMs: 0, maxEntries: 1_000 }),
})
let championships = await api.championships()
console.log(`championships: ${championships.length}, current: ${findCurrentChampionship(championships)?.id}`)
let failures = 0
for (let championship of championships) {
  try {
    let [players, matches, currentTips] = await Promise.all([
      api.players(championship.id),
      api.matches(championship.id),
      api.currentTips(championship.id),
    ])
    let leader = defaultPlayer(players)
    let match = defaultMatch(matches.matches)
    let playerTips = leader ? await api.playerTips(championship.id, leader.playerId) : undefined
    let matchTips = match ? await api.matchTips(championship.id, match.nr) : undefined
    let kinds: Record<string, number> = {}
    for (let m of matches.matches) {
      let cell = describeTip(m, playerTips?.tips[m.id])
      kinds[cell.kind] = (kinds[cell.kind] ?? 0) + 1
    }
    console.log(
      [
        championship.id.padEnd(7),
        `players=${players.length}`,
        `ranked=${hasRanking(players)}`,
        `matches=${matches.matches.length}`,
        `currentTips=${currentTips.length}`,
        `leader=${leader?.playerId}`,
        `defaultMatch=${match?.nr}`,
        `matchTips=${matchTips ? Object.keys(matchTips.tips).length : '-'}`,
        `leaderCells=${JSON.stringify(kinds)}`,
      ].join(' '),
    )
  } catch (error) {
    failures++
    console.error(championship.id, error)
  }
}
process.exitCode = failures ? 1 : 0
