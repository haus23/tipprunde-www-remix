import { clientEntry, css, on, ref, type Handle } from 'remix/ui'

export interface SwitcherItem {
  id: string
  name: string
  href: string
  /** The newest published championship. */
  isCurrent: boolean
  /** The championship on screen. */
  selected: boolean
}

interface SwitcherProps {
  label: string
  items: SwitcherItem[]
}

/**
 * Disclosure navigation listing all published championships.
 *
 * Works without JavaScript as a native `<details>` element with plain links.
 * Once hydrated it also closes on Escape (returning focus to the trigger), on
 * outside clicks and after choosing an entry.
 */
export const ChampionshipSwitcher = clientEntry(
  import.meta.url,
  function ChampionshipSwitcher(handle: Handle<SwitcherProps>) {
    let open = false
    let details: HTMLDetailsElement | undefined
    let summary: HTMLElement | undefined

    function close(focusTrigger: boolean) {
      // The native `toggle` event is async; trust the element, not our copy.
      if (!open && !details?.open) return
      open = false
      if (details) details.open = false
      handle.update()
      if (focusTrigger) summary?.focus()
    }

    handle.queueTask(() => {
      document.addEventListener(
        'pointerdown',
        (event) => {
          if (details?.open && !details.contains(event.target as Node)) close(false)
        },
        { signal: handle.signal },
      )
    })

    return () => {
      let { label, items } = handle.props
      let selected = items.find((item) => item.selected)

      return (
        <details
          open={open}
          mix={[
            rootStyle,
            ref((node) => (details = node)),
            on('toggle', (event) => {
              if (event.currentTarget.open === open) return
              open = event.currentTarget.open
              handle.update()
            }),
            on('keydown', (event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                close(true)
              }
            }),
          ]}
        >
          <summary mix={[triggerStyle, ref((node) => (summary = node))]}>
            <span class="sr-only">{label}: </span>
            <span mix={triggerLabelStyle}>{selected?.name ?? 'Turnier wählen'}</span>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" mix={chevronStyle}>
              <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </summary>
          <nav aria-label={label} mix={panelStyle}>
            <ul mix={listStyle}>
              {items.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.href}
                    aria-current={item.selected ? 'page' : undefined}
                    mix={[itemStyle, on('click', () => close(false))]}
                  >
                    <span>{item.name}</span>
                    {item.isCurrent ? <span mix={badgeStyle}>aktuell</span> : null}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </details>
      )
    }
  },
)

const rootStyle = css({
  position: 'relative',
  '&[open] > summary svg': { transform: 'rotate(180deg)' },
})

const triggerStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
  minHeight: '2.75rem',
  padding: '0.375rem 0.625rem 0.375rem 0.875rem',
  border: '1px solid var(--border)',
  borderRadius: '999px',
  background: 'var(--surface)',
  fontWeight: 600,
  cursor: 'pointer',
  listStyle: 'none',
  userSelect: 'none',
  transition: 'transform 160ms var(--ease-out), background-color 150ms ease',
  '&::-webkit-details-marker': { display: 'none' },
  '&:active': { transform: 'scale(0.97)' },
  '@media (hover: hover) and (pointer: fine)': {
    '&:hover': { background: 'var(--surface-2)' },
  },
})

const triggerLabelStyle = css({
  maxWidth: 'min(12rem, 42vw)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

const chevronStyle = css({
  flex: 'none',
  color: 'var(--text-muted)',
  transition: 'transform 200ms var(--ease-out)',
})

const panelStyle = css({
  position: 'absolute',
  insetInlineEnd: 0,
  top: 'calc(100% + 0.5rem)',
  zIndex: 30,
  width: 'min(18rem, calc(100vw - 2rem))',
  maxHeight: 'min(70vh, 28rem)',
  overflowY: 'auto',
  padding: '0.375rem',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--surface)',
  boxShadow: '0 12px 32px rgb(16 24 40 / 0.16)',
  transformOrigin: 'top right',
  animation: 'enter-down 180ms var(--ease-out)',
  '@media (prefers-reduced-motion: reduce)': { animationName: 'enter-fade' },
})

const listStyle = css({ display: 'grid', gap: '2px' })

const itemStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  minHeight: '2.5rem',
  padding: '0.5rem 0.75rem',
  borderRadius: 'var(--radius-sm)',
  textDecoration: 'none',
  '&[aria-current="page"]': {
    background: 'var(--accent-soft)',
    color: 'var(--accent-text)',
    fontWeight: 600,
  },
  '@media (hover: hover) and (pointer: fine)': {
    '&:hover:not([aria-current="page"])': { background: 'var(--surface-2)' },
  },
})

const badgeStyle = css({
  flex: 'none',
  padding: '0.0625rem 0.5rem',
  borderRadius: '999px',
  background: 'var(--surface-3)',
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  fontWeight: 600,
})
