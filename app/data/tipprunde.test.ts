import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  championship,
  championships,
  match,
  player,
  rankedPlayers,
  tip,
  unrankedPlayers,
} from '../../test/fixtures.ts'
import {
  countEvaluated,
  defaultMatch,
  defaultPlayer,
  describeTip,
  findChampionship,
  findCurrentChampionship,
  findLastEvaluatedMatch,
  findNeighbours,
  groupByRound,
  isEvaluated,
  parseMatchNr,
  pointsAverage,
  roundStats,
  selectMatch,
  selectPlayer,
  tableKind,
  tablePoints,
} from './tipprunde.ts'

describe('championship selection', () => {
  it('uses the published championship with the highest nr, independent of API order', () => {
    let shuffled = [championships[2]!, championships[0]!, championships[1]!]
    assert.equal(findCurrentChampionship(shuffled)?.id, 'hr2627')
  })

  it('ignores unpublished championships', () => {
    let list = [...championships, championship({ id: 'xx9999', nr: 99, published: false })]
    assert.equal(findCurrentChampionship(list)?.id, 'hr2627')
    assert.equal(findChampionship(list, 'xx9999'), undefined)
  })

  it('resolves a slug and rejects unknown slugs', () => {
    assert.equal(findChampionship(championships, 'wm2026')?.name, 'WM 2026')
    assert.equal(findChampionship(championships, 'zz0000'), undefined)
    assert.equal(findChampionship(championships, 'spieler'), undefined)
  })

  it('returns undefined when there is no championship at all', () => {
    assert.equal(findCurrentChampionship([]), undefined)
  })
})

describe('player selection', () => {
  it('defaults to the table leader (smallest rank, first in API order on ties)', () => {
    assert.equal(defaultPlayer(rankedPlayers)?.playerId, 'tom')
  })

  it('falls back to the first participant from the API without a ranking', () => {
    assert.equal(defaultPlayer(unrankedPlayers)?.playerId, 'carla')
  })

  it('selects by member id (playerId), not by participation id', () => {
    assert.equal(selectPlayer(rankedPlayers, 'micha').player?.id, 'part-micha')
    let byParticipationId = selectPlayer(rankedPlayers, 'part-micha')
    assert.equal(byParticipationId.player?.playerId, 'tom')
    assert.equal(byParticipationId.fallback, true)
  })

  it('falls back to the default for unknown or empty values', () => {
    assert.deepEqual(selectPlayer(rankedPlayers, 'nobody'), { player: rankedPlayers[1], fallback: true })
    assert.deepEqual(selectPlayer(rankedPlayers, null), { player: rankedPlayers[1], fallback: false })
    assert.equal(selectPlayer(rankedPlayers, '').player?.playerId, 'tom')
  })

  it('handles a championship without participants', () => {
    assert.deepEqual(selectPlayer([], 'tom'), { player: undefined, fallback: true })
  })
})

describe('match selection', () => {
  let matches = [
    match(1, { date: '2026-04-20', result: '1:0' }),
    match(2, { date: '2026-04-26', result: '0:2' }),
    match(3, { date: '2026-04-24', result: '3:1' }),
    match(4, { date: '2026-04-26', result: '' , points: 0 }),
    match(5, { date: '2026-05-01' }),
  ]

  it('treats a match as evaluated exactly when result is not empty', () => {
    assert.equal(isEvaluated(match(1, { result: '0:0' })), true)
    assert.equal(isEvaluated(match(1, { result: '', points: 12 })), false)
  })

  it('defaults to the chronologically last evaluated match, not the highest nr', () => {
    assert.equal(findLastEvaluatedMatch([match(9, { date: '2026-04-26', result: '1:0' }), match(10, { date: '2026-04-24', result: '1:1' })])?.nr, 9)
    assert.equal(defaultMatch(matches)?.nr, 2)
  })

  it('breaks date ties by the higher nr', () => {
    let tied = [match(7, { date: '2026-01-01', result: '1:0' }), match(8, { date: '2026-01-01', result: '2:0' })]
    assert.equal(defaultMatch(tied)?.nr, 8)
  })

  it('uses the smallest nr when nothing is evaluated yet', () => {
    assert.equal(defaultMatch([match(3), match(2), match(4)])?.nr, 2)
  })

  it('returns no match for a championship without matches', () => {
    assert.deepEqual(selectMatch([], '3'), { match: undefined, fallback: true })
  })

  it('selects an explicit nr and falls back for invalid values', () => {
    assert.equal(selectMatch(matches, '5').match?.nr, 5)
    for (let value of ['99', 'abc', '0', '-1', '2.5', '']) {
      let selection = selectMatch(matches, value)
      assert.equal(selection.match?.nr, 2, value)
      assert.equal(selection.fallback, true)
    }
  })

  it('parses only positive integers', () => {
    assert.equal(parseMatchNr('12'), 12)
    assert.equal(parseMatchNr('1e3'), undefined)
    assert.equal(parseMatchNr(' 3'), undefined)
    assert.equal(parseMatchNr(undefined), undefined)
  })

  it('finds neighbours by ascending nr, including gaps and both ends', () => {
    let list = [match(3), match(1), match(7)]
    assert.deepEqual(findNeighbours(list, list[1]!), { previous: undefined, next: list[0] })
    assert.deepEqual(findNeighbours(list, list[0]!), { previous: list[1], next: list[2] })
    assert.deepEqual(findNeighbours(list, list[2]!), { previous: list[0], next: undefined })
    assert.deepEqual(findNeighbours([list[0]!], list[0]!), { previous: undefined, next: undefined })
  })

  it('groups matches by round in nr order', () => {
    let rounds = [
      { id: 'r2', nr: 2, isDoubleRound: true },
      { id: 'r1', nr: 1, isDoubleRound: false },
    ]
    let groups = groupByRound(rounds, [match(3, { roundId: 'r2' }), match(2, { roundId: 'r1' }), match(1, { roundId: 'r1' })])
    assert.deepEqual(
      groups.map((g) => [g.round.id, g.matches.map((m) => m.nr)]),
      [
        ['r1', [1, 2]],
        ['r2', [3]],
      ],
    )
  })
})

describe('tip cells', () => {
  let evaluated = match(1, { result: '2:1' })
  let open = match(2)

  it('shows a missing tip on an evaluated match as 0 points, distinct from a scored 0', () => {
    let missing = describeTip(evaluated, undefined)
    let zero = describeTip(evaluated, tip('p', 'match-1', { tip: '0:0', points: 0 }))
    assert.deepEqual(missing, { kind: 'missing', tip: undefined, points: 0 })
    assert.equal(zero.kind, 'scored')
    assert.equal(zero.kind === 'scored' && zero.points, 0)
  })

  it('treats an empty tip string as no tip', () => {
    assert.equal(describeTip(evaluated, tip('p', 'match-1', { tip: '' })).kind, 'missing')
  })

  it('never invents points when a submitted tip lacks them', () => {
    assert.equal(describeTip(evaluated, tip('p', 'match-1', { tip: '2:1' })).kind, 'uncalculated')
  })

  it('does not show points for unevaluated matches even if points exist', () => {
    assert.equal(describeTip(open, tip('p', 'match-2', { points: 3 })).kind, 'open')
  })
})

describe('statistics', () => {
  it('averages regular points over evaluated matches only', () => {
    let matches = [match(1, { result: '1:0' }), match(2, { result: '0:0' }), match(3), match(4)]
    assert.equal(countEvaluated(matches), 2)
    assert.equal(pointsAverage(9, countEvaluated(matches)), 4.5)
    assert.equal(pointsAverage(9, 0), undefined)
    assert.equal(pointsAverage(undefined, 3), undefined)
  })

  it('sums round points and ignores uncalculated tips', () => {
    let matches = [match(1, { result: '1:0' }), match(2, { result: '0:0' }), match(3, { result: '2:2' }), match(4)]
    let tips = {
      'match-1': tip('p', 'match-1', { tip: '1:0', points: 3, joker: true }),
      'match-3': tip('p', 'match-3', { tip: '2:2' }),
      'match-4': tip('p', 'match-4', { tip: '1:1', points: 6 }),
    }
    assert.deepEqual(roundStats(matches, tips), { evaluated: 3, points: 3, average: 1 })
  })

  it('distinguishes participants, running and final tables', () => {
    assert.equal(tableKind(championship(), unrankedPlayers), 'participants')
    assert.equal(tableKind(championship(), rankedPlayers), 'running')
    assert.equal(tableKind(championship({ completed: true }), rankedPlayers), 'final')
  })

  it('never reveals extra points through the displayed total when they are unpublished', () => {
    let p = player('x', { points: 10, extraPoints: 5, totalPoints: 15 })
    assert.equal(tablePoints(p, championship({ extraPointsPublished: false })), 10)
    assert.equal(tablePoints(p, championship({ extraPointsPublished: true })), 15)
  })
})
