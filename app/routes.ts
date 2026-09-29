import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  current: {
    ranking: get('/'),
    players: get('/spieler'),
    matches: get('/spiel'),
  },
  championship: route('/:slug', {
    ranking: get('/'),
    players: get('/spieler'),
    matches: get('/spiel'),
  }),
})
