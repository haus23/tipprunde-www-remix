import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { Championship, ChampionshipMatches, ChampionshipPlayer, CurrentTipsMatch } from '../../data/schemas.ts'
import { describeTip, tableKind, tablePoints, type TableKind } from '../../data/tipprunde.ts'
import { ApiError } from '../../data/unterbau.ts'
import { EmptyState, InlineError, PageHeader, TableScroller, tableStyle } from '../../ui/components.tsx'
import { formatDate, formatPoints } from '../../ui/format.ts'
import { Layout } from '../../ui/layout.tsx'
import type { ChampionshipLinks } from '../../ui/links.ts'
import { teamName } from '../../ui/match-labels.ts'
import { isHighlighted, Legend, PointsValue, TipValue } from '../../ui/tips.tsx'
import type { AppContext } from '../../router.tsx'
import { NoChampionshipsPage, NotFoundPage } from './errors.tsx'
import { loadScope, type Scope } from './scope.ts'

export async function rankingAction(context: AppContext, slug?: string) {
  let result = await loadScope(context, 'ranking', slug)
  if (!result.ok) return renderScopeFailure(context, result)
  let { scope } = result
  let { championship } = scope

  let [players, matches, currentTips] = await Promise.all([
    context.api.players(championship.id),
    context.api.matches(championship.id),
    // Only running championships have current tips; the API returns [] otherwise.
    championship.completed
      ? Promise.resolve<CurrentTipsResult>({ ok: true, value: [] })
      : context.api.currentTips(championship.id).then(
          (value): CurrentTipsResult => ({ ok: true, value }),
          (error: unknown): CurrentTipsResult => {
            if (error instanceof ApiError) return { ok: false, error }
            throw error
          },
        ),
  ])

  return context.render(
    <RankingPage scope={scope} players={players} matches={matches} currentTips={currentTips} />,
  )
}

export function renderScopeFailure(
  context: AppContext,
  result: Extract<Awaited<ReturnType<typeof loadScope>>, { ok: false }>,
) {
  if (result.reason === 'no-championships') return context.render(<NoChampionshipsPage shell={result.shell} />)
  return context.render(<NotFoundPage shell={result.shell} what="Dieses Turnier gibt es nicht (mehr)." />, {
    status: 404,
  })
}

type CurrentTipsResult = { ok: true; value: CurrentTipsMatch[] } | { ok: false; error: ApiError }

interface RankingPageProps {
  scope: Scope
  players: ChampionshipPlayer[]
  matches: ChampionshipMatches
  currentTips: CurrentTipsResult
}

const HEADINGS: Record<TableKind, string> = {
  participants: 'Teilnehmer',
  running: 'Aktuelle Tabelle',
  final: 'Abschlusstabelle',
}

function RankingPage(handle: Handle<RankingPageProps>) {
  return () => {
    let { scope, players, matches, currentTips } = handle.props
    let { championship, links } = scope
    let kind = tableKind(championship, players)
    let tips = currentTips.ok ? currentTips.value : []

    return (
      <Layout shell={scope.shell} title={HEADINGS[kind]}>
        <PageHeader eyebrow={championship.name} title={HEADINGS[kind]} />

        {kind === 'participants' && players.length > 0 ? (
          <p mix={introStyle}>Noch keine Wertung – die Tabelle entsteht mit dem ersten gewerteten Spiel.</p>
        ) : null}
        {kind === 'final' ? <p mix={introStyle}>Das Turnier ist abgeschlossen.</p> : null}

        {players.length === 0 ? (
          <EmptyState title="Noch keine Teilnehmer.">
            <p>Sobald sich Mitspieler angemeldet haben, stehen sie hier.</p>
          </EmptyState>
        ) : (
          <RankingTable
            championship={championship}
            players={players}
            matches={matches}
            currentTips={tips}
            links={links}
            kind={kind}
          />
        )}

        {!currentTips.ok ? (
          <InlineError title="Die aktuellen Tipps konnten nicht geladen werden.">
            <p>Die Tabelle ist trotzdem aktuell. Bitte später erneut versuchen.</p>
          </InlineError>
        ) : null}
        {tips.length > 0 && players.length > 0 ? <Legend /> : null}
      </Layout>
    )
  }
}

interface RankingTableProps {
  championship: Championship
  players: ChampionshipPlayer[]
  matches: ChampionshipMatches
  currentTips: CurrentTipsMatch[]
  links: ChampionshipLinks
  kind: TableKind
}

function RankingTable(handle: Handle<RankingTableProps>) {
  return () => {
    let { championship, players, matches, currentTips, links, kind } = handle.props
    let ranked = kind !== 'participants'
    // Extra points are shown only when published, for running and completed championships alike.
    let showExtra = ranked && championship.extraPointsPublished
    let pointsLabel = championship.extraPointsPublished ? 'Gesamt' : 'Punkte'
    let matchByNr = new Map(matches.matches.map((match) => [match.nr, match]))

    return (
      <TableScroller label={`${HEADINGS[kind]} ${championship.name}`}>
        <table
          mix={[tableStyle, rankingStyle]}
          data-ranked={ranked ? '' : undefined}
          data-current-tips={currentTips.length > 0 ? '' : undefined}
        >
          <caption class="sr-only">
            {HEADINGS[kind]} {championship.name}
            {currentTips.length > 0 ? ', mit den Tipps der aktuellen Spiele' : ''}
          </caption>
          <thead>
            <tr>
              {ranked ? (
                <th scope="col" class="num sticky rank">
                  Platz
                </th>
              ) : null}
              <th scope="col" class="sticky name">
                Name
              </th>
              {showExtra ? (
                <th scope="col" class="num">
                  <abbr title="Zusatzpunkte">Zusatz</abbr>
                </th>
              ) : null}
              {ranked ? (
                <th scope="col" class="num">
                  {pointsLabel}
                </th>
              ) : null}
              {currentTips.map((tipsMatch) => {
                let match = matchByNr.get(tipsMatch.nr)
                let home = match ? teamName(matches, match.hometeamId, 'short') : tipsMatch.hometeam || 'offen'
                let away = match ? teamName(matches, match.awayteamId, 'short') : tipsMatch.awayteam || 'offen'
                return (
                  <th key={tipsMatch.matchId} scope="col" class="center current">
                    <a href={links.matches(tipsMatch.nr)} mix={matchHeadStyle}>
                      <span class="teams">
                        {home}
                        <span aria-hidden="true">–</span>
                        <span class="sr-only"> gegen </span>
                        {away}
                      </span>
                      <span class="meta">
                        {tipsMatch.result ? (
                          <>
                            <span class="sr-only">Ergebnis </span>
                            {tipsMatch.result}
                          </>
                        ) : match?.date ? (
                          formatDate(match.date, { withYear: false })
                        ) : (
                          'offen'
                        )}
                      </span>
                    </a>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => {
              let previousRank = index > 0 ? players[index - 1]?.rank : undefined
              let repeated = player.rank !== undefined && player.rank === previousRank
              let points = tablePoints(player, championship)
              return (
                <tr key={player.id}>
                  {ranked ? (
                    <td class="num sticky rank">
                      {player.rank === undefined ? (
                        <span class="muted">
                          <span aria-hidden="true">–</span>
                          <span class="sr-only">ohne Platz</span>
                        </span>
                      ) : repeated ? (
                        // Shared rank: visually suppressed, still announced.
                        <span class="sr-only">{player.rank}.</span>
                      ) : (
                        `${player.rank}.`
                      )}
                    </td>
                  ) : null}
                  <th scope="row" class="sticky name">
                    <a href={links.players(player.playerId)}>{player.account.name}</a>
                  </th>
                  {showExtra ? (
                    <td class="num muted">{player.extraPoints ? formatPoints(player.extraPoints) : ''}</td>
                  ) : null}
                  {ranked ? <td class="num strong">{points === undefined ? '' : formatPoints(points)}</td> : null}
                  {currentTips.map((tipsMatch) => {
                    // current-tips is keyed by ChampionshipPlayer.id (participation id).
                    let cell = describeTip(tipsMatch, tipsMatch.tips[player.id])
                    return (
                      <td
                        key={tipsMatch.matchId}
                        class="center current"
                        data-highlight={isHighlighted(cell) ? '' : undefined}
                      >
                        <span mix={currentCellStyle}>
                          <TipValue cell={cell} />
                          {cell.kind !== 'open' ? (
                            <span class="pts">
                              <PointsValue cell={cell} />
                              <span class="sr-only"> Punkte</span>
                            </span>
                          ) : null}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableScroller>
    )
  }
}

const introStyle = css({ color: 'var(--text-muted)', marginTop: '-0.75rem' })

const rankingStyle = css({
  '& .sticky': { position: 'sticky', background: 'var(--surface)', zIndex: 1 },
  '& thead .sticky': { background: 'var(--surface-2)', zIndex: 2 },
  '& .rank': { left: 0, width: '3.5rem', minWidth: '3.5rem' },
  '& .name': { left: 0, fontWeight: 400 },
  '&[data-ranked] .name': { left: '3.5rem' },
  '&:not([data-current-tips]) tbody .name': { width: '100%' },
  '& .strong': { fontWeight: 700 },
  '& .current': { borderLeft: '1px solid var(--border)', minWidth: '5.5rem' },
  '& td.current[data-highlight]': { background: 'color-mix(in srgb, var(--joker-soft) 70%, transparent)' },
})

const matchHeadStyle = css({
  display: 'grid',
  gap: '0.125rem',
  justifyItems: 'center',
  textDecoration: 'none',
  textTransform: 'none',
  letterSpacing: 0,
  '& .teams': { display: 'inline-flex', gap: '0.2rem', color: 'var(--text)', fontSize: '0.8125rem' },
  '& .meta': { fontWeight: 500 },
  '@media (hover: hover) and (pointer: fine)': {
    '&:hover .teams': { textDecoration: 'underline' },
  },
})

const currentCellStyle = css({
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: '0.375rem',
  '& .pts': {
    minWidth: '1.25rem',
    padding: '0 0.3rem',
    borderRadius: '999px',
    background: 'var(--surface-2)',
    fontSize: '0.8125rem',
  },
})
