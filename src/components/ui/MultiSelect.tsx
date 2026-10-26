import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from './Button'
import {
  toggleValue,
  filterOptions,
  moveHighlight,
  selectAllValues,
  areAllSelected,
  type MultiSelectOption,
} from './multiSelectLogic'

export type { MultiSelectOption } from './multiSelectLogic'

export interface MultiSelectProps {
  /** Trigger label, section header, and the base for the "Filter <label>…" placeholder. */
  label: string
  options: MultiSelectOption[]
  /** Selected option values. */
  value: string[]
  onChange: (next: string[]) => void
  /** Show the search row (default true). */
  searchable?: boolean
  /** Show the uppercase mono section header inside the popover (default true). */
  showSectionHeader?: boolean
  /** Popover alignment relative to the trigger (default 'left'). */
  align?: 'left' | 'right'
  triggerClassName?: string
  ariaLabel?: string
  /**
   * Show a "Select all" control in the footer (default false). When on, it
   * appears before "Clear" and selects every currently-visible (search-filtered)
   * option; it hides once everything visible is already selected.
   */
  enableSelectAll?: boolean
  /**
   * Optional per-option accessory rendered right-aligned inside each row,
   * BEFORE the checkmark. Return `null` to render nothing for a row. Clicks
   * inside the accessory are isolated (they do NOT toggle the row), so it can
   * host its own interactive control (e.g. a proficiency-range segmented
   * control) while the rest of the row still toggles selection.
   */
  renderAccessory?: (option: MultiSelectOption, selected: boolean) => React.ReactNode
}

/** Right-aligned cyan checkmark shown on selected rows (M3 "command menu"). */
function CheckIcon() {
  return (
    <svg
      className="ui-multiselect__check"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

/**
 * Reusable Vercel/Geist "command menu" multi-select (mockup variant M3). Owns
 * its open / search / keyboard-highlight state internally; the caller only
 * supplies `value` + `onChange`. Keyboard-first: type to filter, ↑/↓ to move
 * the highlight, ↵/Space to toggle (stays open for multi-pick), Esc to close.
 */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  searchable = true,
  showSectionHeader = true,
  align = 'left',
  triggerClassName,
  ariaLabel,
  enableSelectAll = false,
  renderAccessory,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listId = useId()

  const filtered = useMemo(() => filterOptions(options, query), [options, query])

  // Outside-click + Escape closing — the primitive owns its own dismissal so
  // call sites don't need a sentinel overlay or a ref-based handler.
  useEffect(() => {
    if (!open) return
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  // Focus the search input on open; reset the highlight to the top of the list.
  useEffect(() => {
    if (open) {
      setHighlight(0)
      if (searchable) inputRef.current?.focus()
    }
  }, [open, searchable])

  // Keep the highlight in range as the filtered list shrinks while typing.
  useEffect(() => {
    setHighlight(h => (h >= filtered.length ? Math.max(0, filtered.length - 1) : h))
  }, [filtered.length])

  function close() {
    setOpen(false)
    setQuery('')
  }

  function toggle(optValue: string) {
    onChange(toggleValue(value, optValue))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => moveHighlight(h, 1, filtered.length))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => moveHighlight(h, -1, filtered.length))
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      // Space toggles the highlighted row; in the search field a space would
      // otherwise type into the query, so only intercept when there's a match.
      const opt = filtered[highlight]
      if (!opt) return
      if (e.key === ' ' && searchable && document.activeElement === inputRef.current && query.length > 0) {
        // Let the user type spaces into a non-empty query.
        return
      }
      e.preventDefault()
      toggle(opt.value)
    }
  }

  const count = value.length
  const hasSelection = count > 0
  const triggerClasses = ['ui-multiselect__trigger', 'kanban-ghost', triggerClassName]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={rootRef} className="ui-multiselect" onKeyDown={onKeyDown}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`${triggerClasses}${hasSelection ? ' ui-multiselect__trigger--has' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="ui-multiselect__label">{label}</span>
        {hasSelection && <span className="ui-multiselect__badge">{count}</span>}
        <span className="ui-multiselect__chev" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </Button>

      {open && (
        <div
          className={`ui-multiselect__pop${align === 'right' ? ' ui-multiselect__pop--right' : ''}`}
          role="presentation"
        >
          {searchable && (
            <div className="ui-multiselect__search">
              <SearchIcon />
              <input
                ref={inputRef}
                type="text"
                className="ui-multiselect__input"
                placeholder={`Filter ${label.toLowerCase()}…`}
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label={`Filter ${label}`}
              />
              <span className="ui-multiselect__kbd" aria-hidden="true">esc</span>
            </div>
          )}

          <div className="ui-multiselect__list" role="listbox" aria-multiselectable="true" id={listId}>
            {showSectionHeader && <div className="ui-multiselect__section">{label}</div>}
            {filtered.length === 0 ? (
              <div className="ui-multiselect__empty">No matches</div>
            ) : (
              filtered.map((opt, i) => {
                const selected = value.includes(opt.value)
                const active = i === highlight
                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={selected}
                    className={`ui-multiselect__opt${active ? ' ui-multiselect__opt--active' : ''}${selected ? ' ui-multiselect__opt--sel' : ''}`}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => toggle(opt.value)}
                  >
                    {opt.color && (
                      <span className="ui-multiselect__dot" style={{ background: opt.color }} aria-hidden="true" />
                    )}
                    <span className="ui-multiselect__opt-label">{opt.label}</span>
                    {renderAccessory && (() => {
                      const accessory = renderAccessory(opt, selected)
                      if (accessory == null) return null
                      // Isolate accessory interaction: clicks/keydowns inside the
                      // slot must not bubble up to the row's toggle handler, so
                      // the accessory can be independently interactive.
                      return (
                        <span
                          className="ui-multiselect__accessory"
                          onClick={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                          onKeyDown={e => e.stopPropagation()}
                        >
                          {accessory}
                        </span>
                      )
                    })()}
                    {selected && <CheckIcon />}
                  </div>
                )
              })
            )}
          </div>

          <div className="ui-multiselect__foot">
            <span>{count} selected</span>
            <span className="ui-multiselect__hint">
              <span className="ui-multiselect__kbd" aria-hidden="true">{'↑↓'}</span>
              <span className="ui-multiselect__kbd" aria-hidden="true">{'↵'}</span>
              {enableSelectAll && !areAllSelected(value, filtered) && (
                <span
                  className="ui-multiselect__selectall"
                  role="button"
                  tabIndex={0}
                  onClick={() => onChange(selectAllValues(value, filtered))}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(selectAllValues(value, filtered)) } }}
                >
                  Select all
                </span>
              )}
              {hasSelection && (
                <span
                  className="ui-multiselect__clear"
                  role="button"
                  tabIndex={0}
                  onClick={() => onChange([])}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange([]) } }}
                >
                  Clear
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
