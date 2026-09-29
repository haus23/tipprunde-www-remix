import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { Championship, ChampionshipMatches, ChampionshipPlayer, ChampionshipPlayerTips } from '../../data/schemas.ts'
import {
  countEvaluated,
  describeTip,
  findLastEvaluatedMatch,
  groupByRound,
  isEvaluated,
  pointsAverage,
  roundStats,
  selectPlayer,
  sortByNr,
} from '../../data/tipprunde.ts'
import { ApiError } from '../../data/unterbau.ts'
import { EmptyState, InlineError, PageHeader, StatList, TableScroller, tableStyle, type Stat } from '../../ui/components.tsx'
import { formatAverage, formatDate, formatPoints } from '../../ui/format.ts'
import { Layout } from '../../ui/layout.tsx'
import type { ChampionshipLinks } from '../../ui/links.ts'
import { matchLabel } from '../../ui/match-labels.ts'
import { SelectNavigator } from '../../ui/public/select-navigator.tsx'
import { isHighlighted, Legend, PointsValue, TipValue } from '../../ui/tips.tsx'
import type { AppContext } from '../../router.tsx'
import { renderScopeFailure } from './ranking.tsx'
import { loadScope, type Scope } from './scope.ts'

type TipsResult = { ok: true; value: ChampionshipPlayerTips } | { ok: false; error: ApiError }

export async function playersAction(context: AppContext, slug?: string) {
  let result = await loadScope(context, 'players', slug)
  if (!result.ok) return renderScopeFailure(context, result)
  let { scope } = result
  let { championship } = scope

  let [players, matches] = await Promise.all([
    context.api.players(championship.id),
    context.api.matches(championship.id),
  ])

  // `?name=` holds ChampionshipPlayer.playerId (the member id). Validate it
  // against the loaded list before asking for detail data.
  let selection = selectPlayer(players, context.url.searchParams.get('name'))
  let player = selection.player
  let tips: TipsResult | undefined
  if (player) {
    tips = await context.api.playerTips(championship.id, player.playerId).then(
      (value): TipsResult => ({ ok: true, value }),
      (error: unknown): TipsResult => {
        if (error instanceof ApiError) return { ok: false, error }
        throw error
      },
    )
  }

  return context.render(
    <PlayersPage scope={scope} players={players} player={player} matches={matches} tips={tips} />,
  )
}

interface PlayersPageProps {
  scope: Scope
  players: ChampionshipPlayer[]
  player: ChampionshipPlayer | undefined
  matches: ChampionshipMatches
  tips: TipsResult | undefined
}

function PlayersPage(handle: Handle<PlayersPageProps>) {
  return () => {
    let { scope, players, player, matches, tips } = handle.props
    let { championship, links } = scope

    if (!player) {
      return (
        <Layout shell={scope.shell} title="Spieler">
          <PageHeader eyebrow={championship.name} title="Spieler" />
          <EmptyState title="Noch keine Teilnehmer.">
            <p>Sobald sich Mitspieler angemeldet haben, lassen sich hier ihre Tipps ansehen.</p>
          </EmptyState>
        </Layout>
      )
    }

    let options = players
      .map((p) => ({ value: p.playerId, label: p.account.name }))
      .toSorted((a, b) => a.label.localeCompare(b.label, 'de'))

    return (
      <Layout shell={scope.shell} title={`Tipps von ${player.account.name}`}>
        <PageHeader eyebrow={championship.name} title={<>Tipps von {player.account.name}</>}>
          <SelectNavigator
            action={links.players()}
            name="name"
            label="Spieler auswählen"
            value={player.playerId}
            groups={[{ options }]}
          />
        </PageHeader>

        <PlayerStats championship={championship} player={player} matches={matches} />

        {matches.matches.length === 0 ? (
          <EmptyState title="Noch keine Spiele.">
            <p>Die Tipps erscheinen, sobald Spiele angelegt sind.</p>
          </EmptyState>
        ) : tips?.ok ? (
          <>
            <RoundList matches={matches} tips={tips.value} links={links} />
            <Legend showPending />
          </>
        ) : (
          <InlineError title="Die Tipps konnten nicht geladen werden.">
            <p>Bitte später erneut versuchen.</p>
          </InlineError>
        )}
      </Layout>
    )
  }
}

function PlayerStats(handle: Handle<{ championship: Championship; player: ChampionshipPlayer; matches: ChampionshipMatches }>) {
  return () => {
    let { championship, player, matches } = handle.props
    let evaluated = countEvaluated(matches.matches)
    let average = pointsAverage(player.points, evaluated)
    let stats: Stat[] = [
      { label: 'Platz', value: player.rank === undefined ? '–' : `${player.rank}.` },
      { label: 'Spiele', value: String(evaluated), hint: `von ${matches.matches.length}` },
      { label: 'Punkte', value: player.points === undefined ? '–' : formatPoints(player.points) },
    ]
    if (championship.extraPointsPublished) {
      stats.push(
        { label: 'Zusatzpunkte', value: formatPoints(player.extraPoints ?? 0) },
        { label: 'Gesamt', value: player.totalPoints === undefined ? '–' : formatPoints(player.totalPoints) },
      )
    }
    stats.push({ label: 'Schnitt', value: average === undefined ? '–' : formatAverage(average) })
    return <StatList stats={stats} label={`Wertung von ${player.account.name}`} />
  }
}

function RoundList(handle: Handle<{ matches: ChampionshipMatches; tips: ChampionshipPlayerTips; links: ChampionshipLinks }>) {
  return () => {
    let { matches, tips, links } = handle.props
    let groups = groupByRound(matches.rounds, matches.matches).filter((group) => group.matches.length > 0)
    // Open the round of the latest evaluated match, otherwise the first round.
    let openRoundId = findLastEvaluatedMatch(matches.matches)?.roundId ?? groups[0]?.round.id

    return (
      <div mix={roundsStyle}>
        {groups.map(({ round, matches: roundMatches }) => {
          let stats = roundStats(roundMatches, tips.tips)
          return (
            <details key={round.id} open={round.id === openRoundId} mix={roundStyle}>
              <summary>
                <span class="title">
                  Runde {round.nr}
                  {round.isDoubleRound ? <span mix={doubleBadgeStyle}>doppelte Punkte</span> : null}
                </span>
                {stats.evaluated > 0 ? (
                  <span class="stats">
                    <span>
                      {stats.evaluated} <span class="label">{stats.evaluated === 1 ? 'Spiel' : 'Spiele'}</span>
                    </span>
                    <span>
                      {formatPoints(stats.points)} <span class="label">Pkt</span>
                    </span>
                    <span>
                      <span class="label" aria-hidden="true">
                        ⌀
                      </span>
                      <span class="sr-only">Schnitt</span> {formatAverage(stats.average ?? 0)}
                    </span>
                  </span>
                ) : (
                  <span class="stats label">noch nicht gewertet</span>
                )}
              </summary>
              <TableScroller label={`Tipps Runde ${round.nr}`}>
                <table mix={[tableStyle, tipsTableStyle]}>
                  <thead>
                    <tr>
                      <th scope="col" class="num hide-sm">
                        Nr
                      </th>
                      <th scope="col" class="hide-sm">
                        Datum
                      </th>
                      <th scope="col" class="grow">
                        Spiel
                      </th>
                      <th scope="col" class="center">
                        Ergebnis
                      </th>
                      <th scope="col" class="center">
                        Tipp
                      </th>
                      <th scope="col" class="num">
                        Pkt
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortByNr(roundMatches).map((match) => {
                      let cell = describeTip(match, tips.tips[match.id])
                      return (
                        <tr key={match.id} data-highlight={isHighlighted(cell) ? '' : undefined}>
                          <td class="num muted hide-sm">{match.nr}</td>
                          <td class="muted hide-sm">{formatDate(match.date)}</td>
                          <td class="grow">
                            <a href={links.matches(match.nr)}>
                              <span class="long">{matchLabel(matches, match, 'long')}</span>
                              <span class="short">{matchLabel(matches, match, 'short')}</span>
                            </a>
                          </td>
                          <td class="center">
                            {isEvaluated(match) ? (
                              match.result
                            ) : (
                              <span class="muted">
                                <span aria-hidden="true">–</span>
                                <span class="sr-only">noch kein Ergebnis</span>
                              </span>
                            )}
                          </td>
                          <td class="center">
                            <TipValue cell={cell} />
                          </td>
                          <td class="num">
                            <PointsValue cell={cell} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableScroller>
            </details>
          )
        })}
      </div>
    )
  }
}

const roundsStyle = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.75rem' })

const roundStyle = css({
  '& > summary': {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.25rem 1rem',
    minHeight: '2.75rem',
    padding: '0.5rem 0.25rem',
    cursor: 'pointer',
    listStyle: 'none',
    fontVariantNumeric: 'tabular-nums',
  },
  '& > summary::-webkit-details-marker': { display: 'none' },
  '& > summary .title': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontWeight: 700,
    fontSize: '1.0625rem',
  },
  '& > summary .title::before': {
    content: '""',
    width: '0.5rem',
    height: '0.5rem',
    borderRight: '2px solid var(--text-muted)',
    borderBottom: '2px solid var(--text-muted)',
    transform: 'rotate(-45deg)',
    transition: 'transform 200ms var(--ease-out)',
  },
  '&[open] > summary .title::before': { transform: 'rotate(45deg)' },
  '& > summary .stats': { display: 'inline-flex', gap: '0.875rem', fontWeight: 600 },
  '& .label': { color: 'var(--text-muted)', fontWeight: 500 },
  '@media (prefers-reduced-motion: reduce)': {
    '& > summary .title::before': { transition: 'none' },
  },
})

const doubleBadgeStyle = css({
  padding: '0.0625rem 0.5rem',
  borderRadius: '999px',
  background: 'var(--accent-soft)',
  color: 'var(--accent-text)',
  fontSize: '0.75rem',
  fontWeight: 600,
})

const tipsTableStyle = css({
  '& .short': { display: 'none' },
  '@media (max-width: 40rem)': {
    '& .hide-sm': { display: 'none' },
    '& .long': { display: 'none' },
    '& .short': { display: 'inline' },
  },
})
