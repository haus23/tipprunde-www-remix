/**
 * Presentation of tips and points. All states come from `describeTip`, so the
 * players view, the matches view and the current tips in the table follow the
 * same rules:
 *
 * | state          | tip cell             | points cell             |
 * | -------------- | -------------------- | ----------------------- |
 * | open           | tip or "–"           | empty ("offen")         |
 * | missing        | "kein Tipp"          | 0 (muted)               |
 * | scored         | tip (+ markers)      | points, 0 included      |
 * | uncalculated   | tip (+ markers)      | "–" ("nicht berechnet") |
 */
import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { hasTip, type TipCell } from '../data/tipprunde.ts'
import { formatPoints } from './format.ts'
import { StarIcon, TargetIcon } from './icons.tsx'

export function TipValue(handle: Handle<{ cell: TipCell }>) {
  return () => {
    let { cell } = handle.props
    let tip = cell.tip
    if (!hasTip(tip)) {
      return cell.kind === 'missing' ? (
        <span mix={mutedStyle}>kein Tipp</span>
      ) : (
        <span mix={mutedStyle}>
          <span aria-hidden="true">–</span>
          <span class="sr-only">kein Tipp</span>
        </span>
      )
    }
    return (
      <span mix={tipStyle}>
        <span>{tip.tip}</span>
        <TipMarkers joker={tip.joker} lonelyHit={tip.lonelyHit === true} />
      </span>
    )
  }
}

export function TipMarkers(handle: Handle<{ joker: boolean; lonelyHit: boolean }>) {
  return () => {
    let { joker, lonelyHit } = handle.props
    if (!joker && !lonelyHit) return null
    return (
      <span mix={markersStyle}>
        {joker ? (
          <span mix={jokerStyle} title="Joker">
            <StarIcon />
            <span class="sr-only">Joker</span>
          </span>
        ) : null}
        {lonelyHit ? (
          <span mix={lonelyStyle} title="Einziger richtiger Tipp">
            <TargetIcon />
            <span class="sr-only">einziger richtiger Tipp</span>
          </span>
        ) : null}
      </span>
    )
  }
}

export function PointsValue(handle: Handle<{ cell: TipCell }>) {
  return () => {
    let { cell } = handle.props
    switch (cell.kind) {
      case 'open':
        return <span class="sr-only">noch nicht gewertet</span>
      case 'missing':
        return (
          <span mix={mutedStyle} title="Kein Tipp abgegeben">
            {formatPoints(cell.points)}
          </span>
        )
      case 'uncalculated':
        return (
          <span mix={mutedStyle} title="Punkte noch nicht berechnet">
            <span aria-hidden="true">–</span>
            <span class="sr-only">nicht berechnet</span>
          </span>
        )
      case 'scored':
        return <span mix={cell.points > 0 ? pointsStyle : undefined}>{formatPoints(cell.points)}</span>
    }
  }
}

/** Row highlight for special tips, as in the legacy app. */
export function isHighlighted(cell: TipCell) {
  return hasTip(cell.tip) && (cell.tip.joker || cell.tip.lonelyHit === true)
}

export function Legend(handle: Handle<{ showPending?: boolean }>) {
  return () => (
    <ul mix={legendStyle} aria-label="Legende">
      <li>
        <span mix={jokerStyle}>
          <StarIcon />
        </span>
        Joker (verdoppelt die Punkte)
      </li>
      <li>
        <span mix={lonelyStyle}>
          <TargetIcon />
        </span>
        einziger richtiger Tipp (Bonus)
      </li>
      <li>
        <span mix={mutedStyle}>kein Tipp</span> zählt bei gewerteten Spielen 0 Punkte
      </li>
      {handle.props.showPending ? (
        <li>
          <span mix={mutedStyle}>–</span> Punkte noch nicht berechnet
        </li>
      ) : null}
    </ul>
  )
}

const mutedStyle = css({ color: 'var(--text-muted)' })

const tipStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  fontWeight: 600,
})

const markersStyle = css({
  display: 'inline-flex',
  gap: '0.125rem',
  fontSize: '0.875em',
})

const markerBase = {
  display: 'inline-grid',
  placeItems: 'center',
  width: '1.35em',
  height: '1.35em',
  borderRadius: '999px',
  '& svg': { width: '0.9em', height: '0.9em' },
}

export const jokerStyle = css({ ...markerBase, background: 'var(--joker-soft)', color: 'var(--joker)' })
export const lonelyStyle = css({ ...markerBase, background: 'var(--lonely-soft)', color: 'var(--lonely)' })

const pointsStyle = css({ fontWeight: 700 })

const legendStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem 1.25rem',
  color: 'var(--text-muted)',
  fontSize: '0.875rem',
  '& li': { display: 'inline-flex', alignItems: 'center', gap: '0.375rem' },
})
