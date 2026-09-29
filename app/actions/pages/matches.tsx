import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'

import type { ChampionshipMatches, ChampionshipMatchTips, ChampionshipPlayer, Match } from '../../data/schemas.ts'
import { describeTip, findNeighbours, groupByRound, isEvaluated, selectMatch } from '../../data/tipprunde.ts'
import { ApiError } from '../../data/unterbau.ts'
import { EmptyState, InlineError, PageHeader, StatList, TableScroller, tableStyle } from '../../ui/components.tsx'
import { formatLongDate, formatPoints } from '../../ui/format.ts'
import { ChevronLeftIcon, ChevronRightIcon } from '../../ui/icons.tsx'
import { Layout } from '../../ui/layout.tsx'
import type { ChampionshipLinks } from '../../ui/links.ts'
import { leagueName, matchLabel, teamName } from '../../ui/match-labels.ts'
import { SelectNavigator } from '../../ui/public/select-navigator.tsx'
import { isHighlighted, Legend, PointsValue, TipValue } from '../../ui/tips.tsx'
import type { AppContext } from '../../router.tsx'
import { renderScopeFailure } from './ranking.tsx'
import { loadScope, type Scope } from './scope.ts'

type TipsResult = { ok: true; value: ChampionshipMatchTips } | { ok: false; error: ApiError }

export async function matchesAction(context: AppContext, slug?: string) {
  let result = await loadScope(context, 'matches', slug)
  if (!result.ok) return renderScopeFailure(context, result)
  let { scope } = result
  let { championship } = scope

  let [players, matches] = await Promise.all([
    context.api.players(championship.id),
    context.api.matches(championship.id),
  ])

  // Validate `?nr=` against the loaded matches; match-tips is only requested
  // for an existing match (never without a valid selection).
  let { match } = selectMatch(matches.matches, context.url.searchParams.get('nr'))
  let tips: TipsResult | undefined
  if (match) {
    tips = await context.api.matchTips(championship.id, match.nr).then(
      (value): TipsResult => ({ ok: true, value }),
      (error: unknown): TipsResult => {
        if (error instanceof ApiError) return { ok: false, error }
        throw error
      },
    )
  }

  return context.render(<MatchesPage scope={scope} players={players} matches={matches} match={match} tips={tips} />)
}

interface MatchesPageProps {
  scope: Scope
  players: ChampionshipPlayer[]
  matches: ChampionshipMatches
  match: Match | undefined
  tips: TipsResult | undefined
}

function MatchesPage(handle: Handle<MatchesPageProps>) {
  return () => {
    let { scope, players, matches, match, tips } = handle.props
    let { championship, links } = scope

    if (!match) {
      return (
        <Layout shell={scope.shell} title="Spiele">
          <PageHeader eyebrow={championship.name} title="Spiele" />
          <EmptyState title="Noch keine Spiele.">
            <p>Sobald Spiele angelegt sind, lassen sich hier alle Tipps vergleichen.</p>
          </EmptyState>
        </Layout>
      )
    }

    let groups = groupByRound(matches.rounds, matches.matches)
      .filter((group) => group.matches.length > 0)
      .map((group) => ({
        label: `Runde ${group.round.nr}`,
        options: group.matches.map((m) => ({
          value: String(m.nr),
          label: `${m.nr}. ${matchLabel(matches, m)}${isEvaluated(m) ? ` (${m.result})` : ''}`,
        })),
      }))
    let { previous, next } = findNeighbours(matches.matches, match)
    let round = matches.rounds.find((r) => r.id === match.roundId)

    return (
      <Layout shell={scope.shell} title={`Spiel ${match.nr}: ${matchLabel(matches, match)}`}>
        <PageHeader eyebrow={championship.name} title="Tipps zum Spiel">
          <MatchPager previous={previous} next={next} links={links} matches={matches}>
            <SelectNavigator
              action={links.matches()}
              name="nr"
              label="Spiel auswählen"
              value={String(match.nr)}
              groups={groups}
            />
          </MatchPager>
        </PageHeader>

        <MatchFacts matches={matches} match={match} roundNr={round?.nr} isDoubleRound={round?.isDoubleRound === true} />

        {tips?.ok ? (
          players.length === 0 ? (
            <EmptyState title="Noch keine Teilnehmer." />
          ) : (
            <>
              <MatchTipsTable players={players} match={match} tips={tips.value} links={links} />
              <Legend showPending />
            </>
          )
        ) : (
          <InlineError title="Die Tipps konnten nicht geladen werden.">
            <p>Bitte später erneut versuchen.</p>
          </InlineError>
        )}
      </Layout>
    )
  }
}

function MatchPager(
  handle: Handle<{
    previous: Match | undefined
    next: Match | undefined
    links: ChampionshipLinks
    matches: ChampionshipMatches
    children?: RemixNode
  }>,
) {
  return () => {
    let { previous, next, links, matches, children } = handle.props
    return (
      <nav aria-label="Spielauswahl" mix={pagerStyle}>
        {previous ? (
          <a
            href={links.matches(previous.nr)}
            rel="prev"
            mix={stepStyle}
            data-rmx-reset-scroll="false"
            data-keep-focus=""
            title={`Vorheriges Spiel: ${matchLabel(matches, previous)}`}
          >
            <ChevronLeftIcon />
            <span class="sr-only">Vorheriges Spiel: {previous.nr}. {matchLabel(matches, previous)}</span>
          </a>
        ) : (
          <span mix={stepStyle} aria-hidden="true" data-disabled="">
            <ChevronLeftIcon />
          </span>
        )}
        {children}
        {next ? (
          <a
            href={links.matches(next.nr)}
            rel="next"
            mix={stepStyle}
            data-rmx-reset-scroll="false"
            data-keep-focus=""
            title={`Nächstes Spiel: ${matchLabel(matches, next)}`}
          >
            <ChevronRightIcon />
            <span class="sr-only">Nächstes Spiel: {next.nr}. {matchLabel(matches, next)}</span>
          </a>
        ) : (
          <span mix={stepStyle} aria-hidden="true" data-disabled="">
            <ChevronRightIcon />
          </span>
        )}
      </nav>
    )
  }
}

function MatchFacts(
  handle: Handle<{ matches: ChampionshipMatches; match: Match; roundNr: number | undefined; isDoubleRound: boolean }>,
) {
  return () => {
    let { matches, match, roundNr, isDoubleRound } = handle.props
    let evaluated = isEvaluated(match)
    let open = !match.hometeamId || !match.awayteamId
    return (
      <section aria-labelledby="match-title" mix={factsStyle}>
        <h2 id="match-title" mix={matchTitleStyle}>
          <span class="nr">{match.nr}.</span> {teamName(matches, match.hometeamId, 'long')}
          <span aria-hidden="true"> – </span>
          <span class="sr-only"> gegen </span>
          {teamName(matches, match.awayteamId, 'long')}
        </h2>
        {open ? <p mix={hintStyle}>Die Paarung steht noch nicht fest.</p> : null}
        <StatList
          label="Spieldaten"
          stats={[
            {
              label: 'Wann',
              value: match.date ? <time dateTime={match.date}>{formatLongDate(match.date)}</time> : 'offen',
            },
            { label: 'Wettbewerb', value: leagueName(matches, match) ?? '–' },
            { label: 'Runde', value: roundNr === undefined ? '–' : String(roundNr) },
            { label: 'Ergebnis', value: evaluated ? match.result : 'offen' },
            {
              label: 'Punkte',
              value: evaluated ? (match.points === undefined ? '–' : formatPoints(match.points)) : '–',
              hint: evaluated ? 'aller Tipps' : undefined,
            },
          ]}
        />
        {isDoubleRound ? (
          <p mix={hintStyle}>Das Spiel läuft in einer Doppelrunde: Alle erzielten Punkte werden verdoppelt.</p>
        ) : null}
        {!evaluated ? <p mix={hintStyle}>Das Spiel ist noch nicht gewertet.</p> : null}
      </section>
    )
  }
}

function MatchTipsTable(
  handle: Handle<{ players: ChampionshipPlayer[]; match: Match; tips: ChampionshipMatchTips; links: ChampionshipLinks }>,
) {
  return () => {
    let { players, match, tips, links } = handle.props
    return (
      <TableScroller label={`Tipps zu Spiel ${match.nr}`}>
        <table mix={tableStyle}>
          <caption class="sr-only">Tipps aller Teilnehmer zu Spiel {match.nr}</caption>
          <thead>
            <tr>
              <th scope="col" class="grow">
                Spieler
              </th>
              <th scope="col" class="center">
                Tipp
              </th>
              <th scope="col" class="num">
                Punkte
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              // match-tips is keyed by ChampionshipPlayer.id; the link uses the member id.
              let cell = describeTip(match, tips.tips[player.id])
              return (
                <tr key={player.id} data-highlight={isHighlighted(cell) ? '' : undefined}>
                  <th scope="row" class="grow" mix={rowHeadStyle}>
                    <a href={links.players(player.playerId)}>{player.account.name}</a>
                  </th>
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
    )
  }
}

const pagerStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
  minWidth: 0,
  maxWidth: '100%',
})

const stepStyle = css({
  flex: 'none',
  display: 'inline-grid',
  placeItems: 'center',
  width: '2.75rem',
  height: '2.75rem',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: '1.25rem',
  touchAction: 'manipulation',
  transition: 'transform 160ms var(--ease-out), background-color 150ms ease',
  '&:active': { transform: 'scale(0.97)' },
  '&[data-disabled]': { opacity: 0.35 },
  '@media (hover: hover) and (pointer: fine)': {
    '&:not([data-disabled]):hover': { background: 'var(--surface-2)' },
  },
})

const factsStyle = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.75rem' })

const matchTitleStyle = css({
  fontSize: '1.25rem',
  lineHeight: 1.3,
  '& .nr': { color: 'var(--text-muted)', fontWeight: 600 },
})

const hintStyle = css({ color: 'var(--text-muted)' })

const rowHeadStyle = css({ fontWeight: 400 })
