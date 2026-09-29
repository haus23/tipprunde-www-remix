import { render } from 'remix/middleware/render'
import { createRouter, type MiddlewareContext } from 'remix/router'

import championshipController from './actions/championship/controller.tsx'
import rootController from './actions/controller.tsx'
import currentController from './actions/current/controller.tsx'
import { NotFoundPage } from './actions/pages/errors.tsx'
import { bareShell } from './actions/pages/scope.ts'
import { provideAssets, type AppAssets } from './assets.ts'
import { errorPages } from './middleware/error-pages.tsx'
import { httpCache } from './middleware/http-cache.ts'
import { unterbau, type UnterbauMiddlewareOptions } from './middleware/unterbau.ts'
import { routes } from './routes.ts'

export interface AppOptions {
  /** Runtime-specific browser asset integration (dev asset server or Worker manifest). */
  assets: AppAssets
  /** Unterbau API settings; defaults to the public production API. */
  api?: UnterbauMiddlewareOptions
  /** Reports unexpected errors (render failures, upstream outages). */
  onError?: (error: unknown) => void
}

type AppMiddleware = [
  ReturnType<typeof httpCache>,
  ReturnType<typeof render>,
  ReturnType<typeof provideAssets>,
  ReturnType<typeof unterbau>,
  ReturnType<typeof errorPages>,
]

export type AppContext = MiddlewareContext<AppMiddleware>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

/**
 * Builds the application router. The same router runs in the Node dev server
 * (`server.ts`), in the Cloudflare Worker (`worker/worker.ts`) and in tests;
 * only the injected assets and API options differ.
 */
export function createAppRouter(options: AppOptions) {
  let onError = options.onError ?? ((error: unknown) => console.error(error))
  let middleware: AppMiddleware = [
    httpCache(),
    render({ assets: options.assets, onError }),
    provideAssets(options.assets),
    unterbau(options.api),
    errorPages(onError),
  ]

  let router = createRouter<AppContext>({
    middleware,
    defaultHandler(context) {
      return context.render(<NotFoundPage shell={bareShell(context)} />, { status: 404 })
    },
  })

  router.map(routes, rootController)
  router.map(routes.current, currentController)
  router.map(routes.championship, championshipController)
  return router
}
