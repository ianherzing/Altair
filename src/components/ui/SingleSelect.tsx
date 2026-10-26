import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from './Button'
import {
  filterOptions,
  moveHighlight,
  type SingleSelectOption,
} from './singleSelectLogic'

export type { SingleSelectOption } from './singleSelectLogic'

export interface SingleSelectProps {
  value: string
  onChange: (value: string) => void
  options: SingleSelectOption[]
  placeholder?: string
  /** Show the search row (default true). */
  searchable?: boolean
  /**
   * How each option's `meta` text is laid out (default `'inline'`).
   * - `'inline'` — meta sits right-aligned on the same row as the label.
   * - `'stacked'` — meta drops to a full-width second line inside the same
   *   option row and wraps, so a long value (e.g. a frozen role scope) reads in
   *   full instead of ellipsizing the label.
   */
  metaLayout?: 'inline' | 'stacked'
  ariaLabel?: string
}

/** Right-aligned cyan checkmark shown on the selected row (M3 "command menu"). */
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
 * Reusable Vercel/Geist "command menu" single-select. The single-pick
 * counterpart to MultiSelect — owns its open / search / keyboard-highlight
 * state internally; the caller only supplies `value` + `onChange`. Selecting a
 * row fires onChange and closes the popover. Keyboard-first: type to filter,
 * ↑/↓ to move the highlight, ↵ to select, Esc to close.
 */
export function SingleSelect({
  value,
  onChange,
  options,
  placeholder,
  searchable = true,
  metaLayout = 'inline',
  ariaLabel,
}: SingleSelectProps) {
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

  function select(optValue: string) {
    onChange(optValue)
    close()
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
    if (e.key === 'Enter') {
      const opt = filtered[highlight]
      if (!opt) return
      e.preventDefault()
      select(opt.value)
    }
  }

  const selectedLabel = options.find(o => o.value === value)?.label
  const hasValue = Boolean(value)

  return (
    <div ref={rootRef} className="ui-multiselect" onKeyDown={onKeyDown}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`ui-multiselect__trigger kanban-ghost${hasValue ? ' ui-multiselect__trigger--has' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? placeholder ?? 'Select'}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="ui-multiselect__label">{selectedLabel || placeholder}</span>
        <span className="ui-multiselect__chev" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </Button>

      {open && (
        <div
          className={`ui-multiselect__pop ui-multiselect__pop--wide${metaLayout === 'stacked' ? ' ui-multiselect__pop--stacked-meta' : ''}`}
          role="presentation"
        >
          {searchable && (
            <div className="ui-multiselect__search">
              <SearchIcon />
              <input
                ref={inputRef}
                type="text"
                className="ui-multiselect__input"
                placeholder="Search…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="Search"
              />
              <span className="ui-multiselect__kbd" aria-hidden="true">esc</span>
            </div>
          )}

          <div className="ui-multiselect__list" role="listbox" id={listId}>
            {filtered.length === 0 ? (
              <div className="ui-multiselect__empty">No matches</div>
            ) : (
              filtered.map((opt, i) => {
                const selected = opt.value === value
                const active = i === highlight
                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={selected}
                    className={`ui-multiselect__opt${active ? ' ui-multiselect__opt--active' : ''}${selected ? ' ui-multiselect__opt--sel' : ''}`}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => select(opt.value)}
                  >
                    <span className="ui-multiselect__opt-label">{opt.label}</span>
                    {opt.meta && <span className="ui-multiselect__meta">{opt.meta}</span>}
                    {selected && <CheckIcon />}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
