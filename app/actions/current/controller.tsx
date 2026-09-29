import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { matchesAction } from '../pages/matches.tsx'
import { playersAction } from '../pages/players.tsx'
import { rankingAction } from '../pages/ranking.tsx'

/** Short URLs of the current championship: `/`, `/spieler`, `/spiel`. */
export default createController(routes.current, {
  actions: {
    ranking: (context) => rankingAction(context),
    players: (context) => playersAction(context),
    matches: (context) => matchesAction(context),
  },
})
