import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { matchesAction } from '../pages/matches.tsx'
import { playersAction } from '../pages/players.tsx'
import { rankingAction } from '../pages/ranking.tsx'

/** A championship chosen by its API id: `/:slug`, `/:slug/spieler`, `/:slug/spiel`. */
export default createController(routes.championship, {
  actions: {
    ranking: (context) => rankingAction(context, context.params.slug),
    players: (context) => playersAction(context, context.params.slug),
    matches: (context) => matchesAction(context, context.params.slug),
  },
})
