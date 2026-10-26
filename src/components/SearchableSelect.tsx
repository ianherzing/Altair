import { useState, useRef, useEffect, useMemo, memo } from 'react'
import { Button } from './ui'

interface Option {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
  autoFocus?: boolean
  /**
   * 'default' (boxed/bordered input) keeps the legacy look used by
   * NonBillByClient. 'ghost' matches the MultiSelect "command menu" filter —
   * ghost trigger + shared `ui-multiselect__*` popover chrome — for a uniform
   * filter bar (Resourcing).
   */
  variant?: 'default' | 'ghost'
  /**
   * Ghost variant only: render a custom trigger instead of the default
   * label + chevron, while keeping the same open/close, search, popover, and
   * keyboard behavior. Lets callers (e.g. the ProjectDetail OffSec Manager
   * row) render an avatar chip without duplicating dropdown logic. The
   * callback receives the current open state and the selected option's label.
   */
  renderTrigger?: (state: { open: boolean; selectedLabel: string; value: string }) => React.ReactNode
}

/** Right-aligned cyan checkmark on the selected row — shared with MultiSelect (M3). */
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

export const SearchableSelect = memo(function SearchableSelect({ options, value, onChange, placeholder = 'Select...', style, autoFocus, variant = 'default', renderTrigger }: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedLabel = useMemo(() => options.find(o => o.value === value)?.label || '', [options, value])

  const filtered = useMemo(() => search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options, [options, search])

  useEffect(() => {
    setHighlightIndex(0)
  }, [search])

  useEffect(() => {
    if (autoFocus) {
      setOpen(true)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [autoFocus])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const items = listRef.current.children
    if (items[highlightIndex]) {
      (items[highlightIndex] as HTMLElement).scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex, open])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlightIndex]) {
        onChange(filtered[highlightIndex].value)
        setOpen(false)
        setSearch('')
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setSearch('')
    }
  }

  function selectOption(val: string) {
    onChange(val)
    setOpen(false)
    setSearch('')
  }

  // ── Ghost variant: matches MultiSelect (shared ui-multiselect__* chrome) ──
  if (variant === 'ghost') {
    const hasSelection = value !== ''
    return (
      <div ref={containerRef} className="ui-multiselect" style={style}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`ui-multiselect__trigger kanban-ghost${hasSelection ? ' ui-multiselect__trigger--has' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={selectedLabel || placeholder}
          onClick={() => {
            if (open) {
              setOpen(false)
              setSearch('')
            } else {
              setOpen(true)
              setTimeout(() => inputRef.current?.focus(), 0)
            }
          }}
        >
          {renderTrigger ? (
            renderTrigger({ open, selectedLabel, value })
          ) : (
            <>
              <span className="ui-multiselect__label">{selectedLabel || placeholder}</span>
              <span className="ui-multiselect__chev" aria-hidden="true">{open ? '▲' : '▼'}</span>
            </>
          )}
        </Button>

        {open && (
          <div className="ui-multiselect__pop" role="presentation">
            <div className="ui-multiselect__search">
              <SearchIcon />
              <input
                ref={inputRef}
                type="text"
                className="ui-multiselect__input"
                placeholder={selectedLabel || placeholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label={placeholder}
              />
              <span className="ui-multiselect__kbd" aria-hidden="true">esc</span>
            </div>

            <div ref={listRef} className="ui-multiselect__list" role="listbox">
              {filtered.length === 0 ? (
                <div className="ui-multiselect__empty">No matches</div>
              ) : (
                filtered.map((o, i) => {
                  const selected = o.value === value
                  const active = i === highlightIndex
                  return (
                    <div
                      key={o.value}
                      role="option"
                      aria-selected={selected}
                      className={`ui-multiselect__opt${active ? ' ui-multiselect__opt--active' : ''}${selected ? ' ui-multiselect__opt--sel' : ''}`}
                      onMouseEnter={() => setHighlightIndex(i)}
                      onMouseDown={e => { e.preventDefault(); selectOption(o.value) }}
                    >
                      <span className="ui-multiselect__opt-label">{o.label}</span>
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

  // ── Default variant: legacy boxed input (unchanged) ──
  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {/* Display / trigger */}
      <div
        onClick={() => {
          setOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        style={{
          padding: '0.25rem 0.4rem',
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 3,
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '0.75rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.25rem',
          minHeight: 26,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {open ? '' : (selectedLabel || placeholder)}
        </span>
        {open ? (
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedLabel || placeholder}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.75rem',
              width: '100%',
              padding: 0,
            }}
          />
        ) : (
          <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>▼</span>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={listRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            minWidth: 300,
            maxHeight: 250,
            overflowY: 'auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 200,
            marginTop: 2,
          }}
        >
          {filtered.length === 0 && (
            <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              No matches
            </div>
          )}
          {filtered.map((o, i) => (
            <div
              key={o.value}
              onMouseDown={e => { e.preventDefault(); selectOption(o.value) }}
              onMouseEnter={() => setHighlightIndex(i)}
              style={{
                padding: '0.35rem 0.5rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                background: i === highlightIndex ? 'var(--brand-cyan-dark)' : 'transparent',
                color: i === highlightIndex ? '#fff' : 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
