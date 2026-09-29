import { clientEntry, css, on, type Handle } from 'remix/ui'

import { freshness, POLL_MS } from './freshness.ts'

interface AppStatusProps {
  /** Running championship: poll while the tab is visible. */
  live: boolean
}

type Bar = 'idle' | 'loading' | 'done'

/**
 * Navigation feedback and background revalidation.
 *
 * Renders nothing visible on the server. In the browser it shows a delayed,
 * thin progress bar for navigations, announces the new page title to screen
 * readers, reports offline/failed states and triggers stale-while-revalidate
 * reloads of the page (policy: ./freshness.ts).
 */
export const AppStatus = clientEntry(import.meta.url, function AppStatus(handle: Handle<AppStatusProps>) {
  let bar: Bar = 'idle'
  let offline = false
  let failed = false
  let announcement = ''
  let navigating = false
  let barTimer: ReturnType<typeof setTimeout> | undefined

  function setBar(next: Bar) {
    bar = next
    clearTimeout(barTimer)
    if (next === 'done') {
      barTimer = setTimeout(() => {
        bar = 'idle'
        handle.update()
      }, 350)
    }
    handle.update()
  }

  async function revalidate({ force = false } = {}) {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return
    if (navigating || freshness.revalidating) return
    if (!force && !freshness.isStale()) return

    freshness.markRevalidationRequest()
    freshness.update({ revalidating: true })
    try {
      await handle.frames.top.reload()
      freshness.update({ revalidating: false, failed: false, loadedAt: Date.now() })
    } catch (error) {
      if (!isAbort(error)) freshness.update({ revalidating: false, failed: true })
      else freshness.update({ revalidating: false })
    }
  }

  handle.queueTask(() => {
    let { signal } = handle
    let top = handle.frames.top
    offline = !navigator.onLine
    freshness.update({ loadedAt: Date.now(), failed: false })

    top.addEventListener(
      'reloadStart',
      () => {
        if (freshness.revalidating) return
        navigating = true
        setBar('loading')
      },
      { signal },
    )
    top.addEventListener(
      'reloadComplete',
      () => {
        if (!navigating) return
        navigating = false
        setBar('done')
        if (!freshness.failed) {
          freshness.update({ loadedAt: Date.now() })
          announcement = document.title
          handle.update()
        }
      },
      { signal },
    )

    freshness.addEventListener(
      'change',
      () => {
        if (failed === freshness.failed) return
        failed = freshness.failed
        handle.update()
      },
      { signal },
    )

    // The Navigation API resets focus to <body> after in-place navigations.
    // Controls that stay on screen (tabs, prev/next, pickers) opt into keeping it.
    let focusTarget: HTMLElement | null = null
    window.navigation?.addEventListener(
      'navigate',
      () => {
        focusTarget = document.activeElement?.closest<HTMLElement>('[data-keep-focus]') ?? null
      },
      { signal },
    )
    window.navigation?.addEventListener(
      'navigatesuccess',
      () => {
        let target = focusTarget
        focusTarget = null
        if (target?.isConnected && (document.activeElement === document.body || document.activeElement === null)) {
          target.focus({ preventScroll: true })
        }
      },
      { signal },
    )

    document.addEventListener('visibilitychange', () => void revalidate(), { signal })
    window.addEventListener('focus', () => void revalidate(), { signal })
    window.addEventListener(
      'pageshow',
      (event) => {
        if (event.persisted) void revalidate()
      },
      { signal },
    )
    window.addEventListener(
      'online',
      () => {
        offline = false
        handle.update()
        // After a failed navigation the URL may already point to the new page.
        void revalidate({ force: freshness.failed })
      },
      { signal },
    )
    window.addEventListener(
      'offline',
      () => {
        offline = true
        handle.update()
      },
      { signal },
    )

    let poll = setInterval(() => {
      if (handle.props.live) void revalidate()
    }, POLL_MS)
    signal.addEventListener('abort', () => {
      clearInterval(poll)
      clearTimeout(barTimer)
    })

    handle.update()
  })

  return () => {
    let message = offline
      ? 'Keine Verbindung. Angezeigt wird der zuletzt geladene Stand.'
      : failed
        ? 'Die Seite konnte nicht geladen werden.'
        : ''

    return (
      <>
        <div mix={barStyle} data-state={bar} aria-hidden="true" />
        <p class="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
        <div mix={toastRegionStyle} role="status" aria-live="polite">
          {message ? (
            <div mix={toastStyle} key={message}>
              <span>{message}</span>
              {!offline ? (
                <button
                  type="button"
                  mix={[
                    retryStyle,
                    on('click', () => {
                      freshness.update({ failed: false })
                      void revalidate({ force: true })
                    }),
                  ]}
                >
                  Erneut laden
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </>
    )
  }
})

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

const barStyle = css({
  position: 'fixed',
  insetInline: 0,
  top: 0,
  zIndex: 50,
  height: '3px',
  background: 'var(--accent)',
  transformOrigin: '0 50%',
  transform: 'scaleX(0)',
  opacity: 0,
  pointerEvents: 'none',
  '&[data-state="loading"]': {
    opacity: 1,
    transform: 'scaleX(0.85)',
    // Only show up when a navigation takes noticeably long.
    transition: 'opacity 150ms ease 120ms, transform 2400ms var(--ease-out) 120ms',
  },
  '&[data-state="done"]': {
    opacity: 0,
    transform: 'scaleX(1)',
    transition: 'transform 150ms var(--ease-out), opacity 200ms ease 100ms',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transform: 'scaleX(1)',
    '&[data-state="loading"]': { transform: 'scaleX(1)', transition: 'opacity 150ms ease 120ms' },
    '&[data-state="done"]': { transform: 'scaleX(1)', transition: 'opacity 200ms ease' },
  },
})

const toastRegionStyle = css({
  position: 'fixed',
  insetInline: '1rem',
  bottom: 'max(1rem, env(safe-area-inset-bottom))',
  zIndex: 40,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
})

const toastStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  maxWidth: '32rem',
  padding: '0.625rem 0.75rem 0.625rem 1rem',
  borderRadius: 'var(--radius)',
  background: 'var(--text)',
  color: 'var(--bg)',
  boxShadow: '0 8px 24px rgb(0 0 0 / 0.18)',
  fontSize: '0.9375rem',
  pointerEvents: 'auto',
  // Keyframes live in the global stylesheet (enter-only, ≤ 200 ms).
  animation: 'enter-up 200ms var(--ease-out)',
  '@media (prefers-reduced-motion: reduce)': { animationName: 'enter-fade' },
})

const retryStyle = css({
  flex: 'none',
  border: 0,
  borderRadius: 'var(--radius-sm)',
  padding: '0.375rem 0.75rem',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'transform 160ms var(--ease-out)',
  '&:active': { transform: 'scale(0.97)' },
})
