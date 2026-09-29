import { createController } from 'remix/router'

import { routes } from '../routes.ts'

export default createController(routes, {
  actions: {
    // Browser modules. In the Worker these are Workers static assets and never
    // reach the app; the Node dev server compiles them on demand.
    async assets(context) {
      return (await context.assets.fetch?.(context.request)) ?? new Response('Not Found', { status: 404 })
    },
  },
})
