import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'

export function PageHeader(handle: Handle<{ eyebrow?: string; title: RemixNode; children?: RemixNode }>) {
  return () => (
    <div mix={pageHeaderStyle}>
      <div>
        {handle.props.eyebrow ? <p mix={eyebrowStyle}>{handle.props.eyebrow}</p> : null}
        <h1 mix={titleStyle}>{handle.props.title}</h1>
      </div>
      {handle.props.children ? <div mix={pageActionsStyle}>{handle.props.children}</div> : null}
    </div>
  )
}

export function EmptyState(handle: Handle<{ title: string; children?: RemixNode }>) {
  return () => (
    <div mix={emptyStyle}>
      <p mix={emptyTitleStyle}>{handle.props.title}</p>
      {handle.props.children ? <div mix={emptyTextStyle}>{handle.props.children}</div> : null}
    </div>
  )
}

export interface Stat {
  label: string
  value: RemixNode
  hint?: string
}

export function StatList(handle: Handle<{ stats: Stat[]; label: string }>) {
  return () => (
    <dl mix={statListStyle} aria-label={handle.props.label}>
      {handle.props.stats.map((stat) => (
        <div key={stat.label} mix={statStyle}>
          <dt>{stat.label}</dt>
          <dd>
            {stat.value}
            {stat.hint ? <span mix={statHintStyle}> {stat.hint}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Horizontally scrollable table container. Focusable and labelled so keyboard
 * users can scroll it; the first column may be made sticky by the table.
 */
export function TableScroller(handle: Handle<{ label: string; children?: RemixNode }>) {
  return () => (
    <div mix={scrollerStyle} role="region" aria-label={handle.props.label} tabIndex={0}>
      {handle.props.children}
    </div>
  )
}

export function InlineError(handle: Handle<{ title: string; children?: RemixNode }>) {
  return () => (
    <div role="alert" mix={inlineErrorStyle}>
      <p mix={emptyTitleStyle}>{handle.props.title}</p>
      {handle.props.children ? <div mix={emptyTextStyle}>{handle.props.children}</div> : null}
    </div>
  )
}

const pageHeaderStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'end',
  justifyContent: 'space-between',
  gap: '0.75rem 1.5rem',
})

const eyebrowStyle = css({
  color: 'var(--text-muted)',
  fontSize: '0.875rem',
  fontWeight: 600,
})

const titleStyle = css({
  fontSize: 'clamp(1.375rem, 1.1rem + 1.2vw, 1.875rem)',
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
})

const pageActionsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  minWidth: 0,
  maxWidth: '100%',
})

const emptyStyle = css({
  display: 'grid',
  gap: '0.375rem',
  padding: '2.5rem 1.5rem',
  border: '1px dashed var(--border)',
  borderRadius: 'var(--radius)',
  textAlign: 'center',
})

const inlineErrorStyle = css({
  display: 'grid',
  gap: '0.375rem',
  padding: '1.25rem 1.5rem',
  borderRadius: 'var(--radius)',
  background: 'var(--danger-soft)',
})

const emptyTitleStyle = css({ fontWeight: 600 })
const emptyTextStyle = css({ color: 'var(--text-muted)' })

const statListStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1px',
  overflow: 'hidden',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--border)',
})

const statStyle = css({
  flex: '1 1 8rem',
  display: 'grid',
  alignContent: 'start',
  gap: '0.125rem',
  padding: '0.75rem 1rem',
  background: 'var(--surface)',
  '& dt': {
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  '& dd': {
    fontSize: '1.25rem',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
})

const statHintStyle = css({
  color: 'var(--text-muted)',
  fontSize: '0.875rem',
  fontWeight: 500,
})

const scrollerStyle = css({
  // Containing block for absolutely positioned descendants (.sr-only), so
  // they are clipped by the scroller instead of widening the page.
  position: 'relative',
  overflowX: 'auto',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--surface)',
  boxShadow: 'var(--shadow)',
  overscrollBehaviorX: 'contain',
})

/** Shared data table look. Use on `<table>`. */
export const tableStyle = css({
  width: '100%',
  fontSize: '0.9375rem',
  '& th, & td': {
    padding: '0.5rem 0.75rem',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  '& thead th': {
    position: 'sticky',
    top: 0,
    background: 'var(--surface-2)',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    verticalAlign: 'bottom',
  },
  '& tbody tr': { borderTop: '1px solid var(--border)' },
  '& tbody tr[data-highlight]': { background: 'color-mix(in srgb, var(--joker-soft) 55%, transparent)' },
  '& .num': { textAlign: 'right' },
  '& .center': { textAlign: 'center' },
  '& .grow': { width: '100%' },
  '& .muted': { color: 'var(--text-muted)' },
  '& td a, & th[scope="row"] a': {
    fontWeight: 600,
    textDecorationColor: 'var(--border)',
    transition: 'text-decoration-color 150ms ease',
  },
  '@media (hover: hover) and (pointer: fine)': {
    '& td a:hover, & th[scope="row"] a:hover': { textDecorationColor: 'currentColor' },
  },
})
