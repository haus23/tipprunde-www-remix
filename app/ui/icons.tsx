/**
 * A handful of hand-drawn 24×24 stroke icons. Decorative by default
 * (`aria-hidden`); meaning is always carried by adjacent or sr-only text.
 */
import type { Handle, RemixNode } from 'remix/ui'

interface IconProps {
  class?: string
}

function icon(children: RemixNode, filled = false) {
  return function Icon(handle: Handle<IconProps>) {
    return () => (
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        aria-hidden="true"
        focusable="false"
        class={handle.props.class}
        fill={filled ? 'currentColor' : 'none'}
        stroke={filled ? 'none' : 'currentColor'}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        {children}
      </svg>
    )
  }
}

export const ChevronLeftIcon = icon(<path d="m15 18-6-6 6-6" />)
export const ChevronRightIcon = icon(<path d="m9 18 6-6-6-6" />)
export const ChevronDownIcon = icon(<path d="m6 9 6 6 6-6" />)
export const CheckIcon = icon(<path d="M20 6 9 17l-5-5" />)
export const TableIcon = icon(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M9 10v10" />
  </>,
)
export const UserIcon = icon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>,
)
export const BallIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m12 7 4 3-1.5 4.5h-5L8 10z" />
    <path d="M12 3v4M16 10l4.5-1.5M14.5 14.5 17 19M9.5 14.5 7 19M8 10 3.5 8.5" />
  </>,
)
/** Joker marker. */
export const StarIcon = icon(
  <path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" />,
  true,
)
/** Lonely-hit marker ("einziger Treffer"). */
export const TargetIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
  </>,
)
export const AlertIcon = icon(
  <>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </>,
)
export const CloudOffIcon = icon(
  <>
    <path d="m2 2 20 20" />
    <path d="M5.8 5.8A7 7 0 0 0 7 20h10a5 5 0 0 0 2.3-.6M21.5 16.4A5 5 0 0 0 17 10h-1.3A7 7 0 0 0 10 5.1" />
  </>,
)
