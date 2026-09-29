import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'

import type { ScriptEntry } from '../assets.ts'
import type { Championship } from '../data/schemas.ts'
import type { DataStatus } from '../data/unterbau.ts'
import { routes } from '../routes.ts'
import { Document } from './document.tsx'
import { formatTime } from './format.ts'
import { AlertIcon, BallIcon, TableIcon, UserIcon } from './icons.tsx'
import type { ChampionshipLinks, View } from './links.ts'
import { Logo } from './logo.tsx'
import { AppStatus } from './public/app-status.tsx'
import { ChampionshipSwitcher, type SwitcherItem } from './public/championship-switcher.tsx'

export interface ShellData {
  entry: ScriptEntry
  status: DataStatus
  /** Championship on screen (absent on global error pages). */
  championship?: Championship
  links?: ChampionshipLinks
  view?: View
  switcher: SwitcherItem[]
}

interface LayoutProps {
  shell: ShellData
  /** Page part of the document title. */
  title: string
  children?: RemixNode
}

const TABS: { view: View; label: string; Icon: typeof TableIcon }[] = [
  { view: 'ranking', label: 'Tabelle', Icon: TableIcon },
  { view: 'players', label: 'Spieler', Icon: UserIcon },
  { view: 'matches', label: 'Spiele', Icon: BallIcon },
]

export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    let { shell, title, children } = handle.props
    let { championship, links, view, status, switcher } = shell
    let fullTitle = [title, championship?.name, 'runde.tips'].filter(Boolean).join(' · ')

    return (
      <Document title={fullTitle} entry={shell.entry}>
        <a href="#inhalt" class="skip-link">
          Zum Inhalt springen
        </a>
        <AppStatus live={championship !== undefined && !championship.completed} />
        <header mix={headerStyle}>
          <div mix={headerInnerStyle}>
            <a href={routes.current.ranking.href()} mix={brandStyle}>
              <Logo class="logo" title="runde.tips" />
              <span>
                runde<span mix={brandDotStyle}>.</span>tips
              </span>
            </a>
            {switcher.length > 0 ? <ChampionshipSwitcher label="Turnier wechseln" items={switcher} /> : null}
          </div>
          {championship && links ? (
            <nav aria-label="Ansichten" mix={tabsStyle}>
              <ul mix={tabListStyle}>
                {TABS.map(({ view: tab, label, Icon }) => (
                  <li key={tab}>
                    <a
                      href={links.view(tab)}
                      aria-current={tab === view ? 'page' : undefined}
                      data-keep-focus=""
                      mix={tabStyle}
                    >
                      <Icon class="tab-icon" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </header>

        <main id="inhalt" tabIndex={-1} mix={mainStyle}>
          {status.degraded ? (
            <p role="status" mix={noticeStyle}>
              <AlertIcon />
              <span>
                Der Datendienst antwortet gerade nicht. Angezeigt wird der Stand von{' '}
                {status.fetchedAt ? formatTime(status.fetchedAt) : 'zuvor'} Uhr.
              </span>
            </p>
          ) : null}
          {children}
        </main>

        <footer mix={footerStyle}>
          {status.fetchedAt ? (
            <p>
              Datenstand <time dateTime={new Date(Math.floor(status.fetchedAt / 1000) * 1000).toISOString()}>{formatTime(status.fetchedAt)}</time>{' '}
              Uhr
            </p>
          ) : null}
          <p>
            Haus 23 Tipprunde · <a href="https://unterbau.runde.tips/">Datendienst</a>
          </p>
        </footer>
      </Document>
    )
  }
}

const headerStyle = css({
  position: 'sticky',
  top: 0,
  zIndex: 20,
  background: 'var(--bg)',
  borderBottom: '1px solid var(--border)',
})

const headerInnerStyle = css({
  width: 'var(--page)',
  marginInline: 'auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  paddingBlock: '0.625rem',
})

const brandStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  minHeight: '2.75rem',
  fontSize: '1.125rem',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  textDecoration: 'none',
  '& .logo': { width: '2.25rem', height: 'auto', flex: 'none' },
  '@media (max-width: 26rem)': { '& > span': { display: 'none' } },
})

const brandDotStyle = css({ color: 'var(--accent)' })

const tabsStyle = css({
  width: 'var(--page)',
  marginInline: 'auto',
})

const tabListStyle = css({
  display: 'flex',
  gap: '0.25rem',
})

const tabStyle = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  minHeight: '2.75rem',
  padding: '0.5rem 0.75rem',
  color: 'var(--text-muted)',
  fontWeight: 600,
  textDecoration: 'none',
  transition: 'color 150ms ease',
  '& .tab-icon': { width: '1.125rem', height: '1.125rem' },
  '&::after': {
    content: '""',
    position: 'absolute',
    insetInline: '0.5rem',
    bottom: '-1px',
    height: '2px',
    borderRadius: '2px',
    background: 'var(--accent)',
    transform: 'scaleX(0)',
    transition: 'transform 200ms var(--ease-out)',
  },
  '&[aria-current="page"]': { color: 'var(--text)' },
  '&[aria-current="page"]::after': { transform: 'scaleX(1)' },
  '@media (hover: hover) and (pointer: fine)': {
    '&:hover': { color: 'var(--text)' },
  },
  '@media (prefers-reduced-motion: reduce)': {
    '&::after': { transition: 'none' },
  },
})

const mainStyle = css({
  flex: '1 0 auto',
  width: 'var(--page)',
  marginInline: 'auto',
  paddingBlock: '1.5rem 3rem',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  alignContent: 'start',
  gap: '1.5rem',
  '&:focus': { outline: 'none' },
})

const noticeStyle = css({
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'flex-start',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--radius)',
  background: 'var(--joker-soft)',
  color: 'var(--text)',
  '& svg': { flex: 'none', marginTop: '0.2em', color: 'var(--joker)' },
})

const footerStyle = css({
  width: 'var(--page)',
  marginInline: 'auto',
  paddingBlock: '1.5rem 2rem',
  borderTop: '1px solid var(--border)',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: '0.5rem 1.5rem',
  color: 'var(--text-muted)',
  fontSize: '0.875rem',
})
