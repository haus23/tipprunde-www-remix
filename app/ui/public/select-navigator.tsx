import { clientEntry, css, on, ref, type Handle } from 'remix/ui'

export interface NavigatorOption {
  value: string
  label: string
}

export interface NavigatorGroup {
  /** `<optgroup>` label; omit for a flat list. */
  label?: string
  options: NavigatorOption[]
}

interface SelectNavigatorProps {
  /** Page URL the selection is sent to (without query). */
  action: string
  /** Query parameter name, e.g. `name` or `nr`. */
  name: string
  label: string
  value: string
  groups: NavigatorGroup[]
}

/**
 * A native `<select>` inside a GET form. Without JavaScript the visitor
 * submits with the "Anzeigen" button. Once hydrated, picking an option with
 * pointer or touch submits right away and the Remix runtime turns it into an
 * in-place navigation that updates the URL (e.g. `?name=tom`).
 *
 * Keyboard users stepping through a closed select with the arrow keys would
 * otherwise trigger a navigation per key press, so keyboard-driven changes are
 * committed with Enter or when the select loses focus.
 */
export const SelectNavigator = clientEntry(
  import.meta.url,
  function SelectNavigator(handle: Handle<SelectNavigatorProps>) {
    let hydrated = false
    let select: HTMLSelectElement | undefined
    let lastKeyAt = 0
    let pendingKeyboardChange = false

    handle.queueTask(() => {
      hydrated = true
      handle.update()
    })

    function submit() {
      pendingKeyboardChange = false
      if (!select || select.value === handle.props.value) return
      select.form?.requestSubmit()
    }

    return () => {
      let { action, name, label, value, groups } = handle.props
      let id = `${handle.id}-select`
      // Keep the element (and its focus) but show the server's selection,
      // e.g. after prev/next navigation or a fallback to the default.
      handle.queueTask(() => {
        if (select && !pendingKeyboardChange && select.value !== value) select.value = value
      })
      return (
        <form method="get" action={action} mix={formStyle}>
          <label for={id} class="sr-only">
            {label}
          </label>
          <span mix={selectWrapStyle}>
            <select
              id={id}
              name={name}
              data-keep-focus=""
              aria-describedby={hydrated ? `${id}-hint` : undefined}
              mix={[
                selectStyle,
                ref((node) => (select = node)),
                on('keydown', (event) => {
                  lastKeyAt = event.timeStamp
                  if (event.key === 'Enter' && pendingKeyboardChange) {
                    event.preventDefault()
                    submit()
                  }
                }),
                on('change', (event) => {
                  if (event.timeStamp - lastKeyAt < 250) {
                    pendingKeyboardChange = true
                    return
                  }
                  submit()
                }),
                on('blur', () => {
                  if (pendingKeyboardChange) submit()
                }),
              ]}
            >
              {groups.map((group, index) =>
                group.label ? (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                      <option key={option.value} value={option.value} selected={option.value === value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  group.options.map((option) => (
                    <option key={`${index}-${option.value}`} value={option.value} selected={option.value === value}>
                      {option.label}
                    </option>
                  ))
                ),
              )}
            </select>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" mix={chevronStyle}>
              <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </span>
          {hydrated ? (
            <span id={`${id}-hint`} class="sr-only">
              Mit der Eingabetaste bestätigen.
            </span>
          ) : (
            <button type="submit" mix={submitStyle}>
              Anzeigen
            </button>
          )}
        </form>
      )
    }
  },
)

const formStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  minWidth: 0,
})

const selectWrapStyle = css({
  position: 'relative',
  display: 'inline-flex',
  minWidth: 0,
  maxWidth: '100%',
})

const selectStyle = css({
  appearance: 'none',
  minWidth: 0,
  maxWidth: '100%',
  minHeight: '2.75rem',
  padding: '0.5rem 2.25rem 0.5rem 0.875rem',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontWeight: 600,
  textOverflow: 'ellipsis',
  cursor: 'pointer',
  transition: 'border-color 150ms ease',
  '@media (hover: hover) and (pointer: fine)': {
    '&:hover': { borderColor: 'var(--text-muted)' },
  },
})

const chevronStyle = css({
  position: 'absolute',
  right: '0.625rem',
  top: '50%',
  translate: '0 -50%',
  color: 'var(--text-muted)',
  pointerEvents: 'none',
})

const submitStyle = css({
  minHeight: '2.75rem',
  padding: '0.5rem 0.875rem',
  border: 0,
  borderRadius: 'var(--radius-sm)',
  background: 'var(--accent)',
  color: 'var(--surface)',
  fontWeight: 600,
  cursor: 'pointer',
})
