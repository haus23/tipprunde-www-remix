import type { Middleware } from 'remix/router'

import { ErrorPage } from '../actions/pages/errors.tsx'
import { bareShell } from '../actions/pages/scope.ts'
import { ApiError } from '../data/unterbau.ts'
import type { AppContext } from '../router.tsx'

/**
 * Turns unexpected failures into a complete, navigable error page instead of a
 * bare 500. Upstream (Unterbau) problems become 502/503 with a German message;
 * everything else is reported through `onError` and rendered as 500.
 */
export function errorPages(onError: (error: unknown) => void): Middleware {
  return async (context, next) => {
    try {
      return await next()
    } catch (error) {
      if (context.request.signal.aborted) throw error
      let app = context as unknown as AppContext
      let page = describe(error)
      if (page.report) onError(error)
      try {
        return app.render(<ErrorPage shell={bareShell(app)} status={page.status} title={page.title} message={page.message} />, {
          status: page.status,
          headers: page.status === 503 ? { 'Retry-After': '30' } : undefined,
        })
      } catch {
        return new Response(page.message, { status: page.status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }
    }
  }
}

function describe(error: unknown) {
  if (error instanceof ApiError) {
    if (error.kind === 'network' || error.status >= 500) {
      return {
        status: 503,
        title: 'Daten gerade nicht erreichbar',
        message: 'Der Datendienst der Tipprunde antwortet im Moment nicht. Bitte versuche es gleich noch einmal.',
        report: true,
      }
    }
    return {
      status: 502,
      title: 'Unerwartete Antwort',
      message: 'Der Datendienst hat eine Antwort geliefert, die wir nicht verarbeiten können.',
      report: true,
    }
  }
  return {
    status: 500,
    title: 'Etwas ist schiefgelaufen',
    message: 'Beim Erstellen der Seite ist ein Fehler aufgetreten.',
    report: true,
  }
}
