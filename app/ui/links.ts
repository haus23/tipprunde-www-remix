import type { Championship } from '../data/schemas.ts'
import { routes } from '../routes.ts'

export type View = 'ranking' | 'players' | 'matches'

/**
 * URL family of a page. `current` pages live at `/`, `/spieler`, `/spiel`;
 * `slug` pages at `/:slug/...`. Links stay within the family the visitor used.
 */
export type UrlFamily = 'current' | 'slug'

export interface ChampionshipLinks {
  ranking(): string
  /** @param accountId `ChampionshipPlayer.playerId` */
  players(accountId?: string): string
  matches(nr?: number): string
  view(view: View): string
}

export function championshipLinks(championship: Pick<Championship, 'id'>, family: UrlFamily): ChampionshipLinks {
  let links: ChampionshipLinks =
    family === 'current'
      ? {
          ranking: () => routes.current.ranking.href(),
          players: (name) => routes.current.players.href(undefined, name ? { searchParams: { name } } : undefined),
          matches: (nr) => routes.current.matches.href(undefined, nr ? { searchParams: { nr: String(nr) } } : undefined),
          view: (view) => links[view](),
        }
      : {
          ranking: () => routes.championship.ranking.href({ slug: championship.id }),
          players: (name) =>
            routes.championship.players.href({ slug: championship.id }, name ? { searchParams: { name } } : undefined),
          matches: (nr) =>
            routes.championship.matches.href(
              { slug: championship.id },
              nr ? { searchParams: { nr: String(nr) } } : undefined,
            ),
          view: (view) => links[view](),
        }
  return links
}

/**
 * Target of the championship switcher: same view, no selection (a player or
 * match of another championship must never leak into the new one). The
 * current championship is addressed through its short URLs.
 */
export function switchHref(target: Championship, current: Championship | undefined, view: View): string {
  return championshipLinks(target, target.id === current?.id ? 'current' : 'slug').view(view)
}
