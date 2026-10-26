import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import { Button } from './Button'
import {
  parseLocalYMD,
  toLocalYMD,
  buildMonthGrid,
  formatDisplayDate,
  isSameDay,
  pickPopoverSide,
  pickPopoverAlign,
} from './datePickerLogic'

export interface DatePickerProps {
  /** 'YYYY-MM-DD' (local), '' = empty. */
  value: string
  /** Emits 'YYYY-MM-DD' (local). */
  onChange: (value: string) => void
  /** Muted placeholder shown when value is empty. */
  placeholder?: string
  /** PREFERRED popover alignment relative to the trigger (default 'left'), the
   * horizontal counterpart of "below" as the preferred vertical side. It is a
   * preference, not the answer: the popover flips to the opposite edge when the
   * preferred side would overrun the viewport (see pickPopoverAlign). */
  align?: 'left' | 'right'
  ariaLabel?: string
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/** Calendar icon — stroke=currentColor so it inherits the trigger's text color. */
function CalendarIcon() {
  return (
    <svg
      className="ui-datepicker__icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

/**
 * Geist date field + calendar popover (design-system "DP-A"). The trigger is a
 * <Button> styled as a field showing the formatted date (or a muted
 * placeholder); clicking opens a single-month calendar. Selecting a day emits
 * 'YYYY-MM-DD' (local) and closes.
 *
 * Timezone safety: parse/emit go through datePickerLogic's local helpers
 * (T00:00:00 anchor in, local getFullYear/Month/Date out) — never toISOString,
 * which would shift the date a day for viewers east of UTC. See the note in
 * datePickerLogic.ts and dateToStr in resourcingUtils.ts.
 */
export function DatePicker({ value, onChange, placeholder = 'Select date', align = 'left', ariaLabel }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState<{ flipUp: boolean; maxHeight: number | null; align: 'left' | 'right' }>({
    flipUp: false,
    maxHeight: null,
    align,
  })
  const selected = useMemo(() => parseLocalYMD(value), [value])

  // The displayed month: the selected date's month if set, else the current
  // month. Tracked as a year/month pair so prev/next never drift on day-31.
  const initial = selected ?? new Date()
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() })

  const rootRef = useRef<HTMLDivElement>(null)

  // When the popover (re)opens, snap the view to the selected month (or today).
  useEffect(() => {
    if (open) {
      const base = parseLocalYMD(value) ?? new Date()
      setView({ year: base.getFullYear(), month: base.getMonth() })
    }
  }, [open, value])

  // Which side the popover opens toward (and an internal-scroll cap when
  // neither side fits — e.g. a short viewport at high zoom inside a fixed
  // dialog, where no side is scroll-reachable). 332px ≈ the fixed calendar
  // height (header + dow + 6 rows) + margin.
  const POP_HEIGHT = 332
  // Mirrors the `width` declaration of `.ui-datepicker__pop` in ui.css — the
  // popover has no intrinsic width to measure before it mounts, so keep the two
  // in sync by hand.
  const POP_WIDTH = 268
  // One getBoundingClientRect read resolves BOTH axes: vertical side + cap, and
  // the horizontal alignment.
  const measureSide = useCallback(() => {
    if (!rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    const vertical = pickPopoverSide(rect.top, window.innerHeight - rect.bottom, POP_HEIGHT)
    // CAUTION: the two space args below are both plain numbers and are
    // cross-wired relative to their names — a LEFT-aligned popover grows
    // rightward, so its room is `spaceRight` = window.innerWidth - rect.left,
    // while a RIGHT-aligned one grows leftward on `spaceLeft` = rect.right.
    // Transposing them type-checks silently and no unit test can catch it; the
    // only symptom is a popover flipping the wrong way on screen.
    const nextAlign = pickPopoverAlign(align, window.innerWidth - rect.left, rect.right, POP_WIDTH)
    const next = { flipUp: vertical.flipUp, maxHeight: vertical.maxHeight, align: nextAlign }
    // Keep the previous object when nothing changed so per-frame scroll
    // re-measures don't re-render the open popover. Every field of the state
    // must be compared here, or a re-measure re-renders on each frame.
    setPlace(prev =>
      prev.flipUp === next.flipUp && prev.maxHeight === next.maxHeight && prev.align === next.align
        ? prev
        : next,
    )
  }, [align])

  useLayoutEffect(() => {
    if (open) measureSide()
  }, [open, measureSide])

  // The dialog body (and other ancestors) can scroll with the popover open —
  // without these the orientation goes stale. capture:true catches scroll on
  // any ancestor (Tooltip's pattern); rAF coalesces bursts so the forced
  // layout read doesn't thrash during active scrolling.
  useEffect(() => {
    if (!open) return
    let raf = 0
    const onScrollOrResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measureSide)
    }
    window.addEventListener('scroll', onScrollOrResize, { capture: true, passive: true })
    window.addEventListener('resize', onScrollOrResize, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, measureSide])

  // Close on outside-click + Esc.
  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const grid = useMemo(() => buildMonthGrid(view.year, view.month), [view])
  const today = useMemo(() => new Date(), [])

  const monthLabel = useMemo(
    () => new Date(view.year, view.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    [view],
  )

  const stepMonth = useCallback((delta: number) => {
    setView(v => {
      const d = new Date(v.year, v.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }, [])

  const pick = useCallback((d: Date) => {
    onChange(toLocalYMD(d))
    setOpen(false)
  }, [onChange])

  const label = selected ? formatDisplayDate(selected) : placeholder

  // Driven by the RESOLVED alignment, not the raw `align` prop — the prop is
  // only the preference the measurement starts from.
  const alignRight = place.align === 'right'

  return (
    <div className="ui-datepicker" ref={rootRef}>
      <Button
        variant="secondary"
        size="sm"
        className={`ui-datepicker__field${selected ? '' : ' ui-datepicker__field--empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen(o => !o)}
      >
        <span className="ui-datepicker__value">{label}</span>
        <CalendarIcon />
      </Button>

      {open && (
        <div
          className={`ui-datepicker__pop${alignRight ? ' ui-datepicker__pop--right' : ''}${place.flipUp ? ' ui-datepicker__pop--up' : ''}`}
          style={place.maxHeight !== null ? { maxHeight: place.maxHeight, overflowY: 'auto' } : undefined}
          role="dialog"
          aria-label={ariaLabel || 'Choose date'}
        >
          <div className="ui-datepicker__header">
            <Button variant="ghost" size="sm" icon={<ChevronLeftIcon />} aria-label="Previous month" onClick={() => stepMonth(-1)} />
            <span className="ui-datepicker__month">{monthLabel}</span>
            <Button variant="ghost" size="sm" icon={<ChevronRightIcon />} aria-label="Next month" onClick={() => stepMonth(1)} />
          </div>

          <div className="ui-datepicker__dow" aria-hidden="true">
            {WEEKDAYS.map(d => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="ui-datepicker__grid" role="grid">
            {grid.map(cell => {
              const isSel = selected != null && isSameDay(cell.date, selected)
              const isToday = isSameDay(cell.date, today)
              const cls = [
                'ui-datepicker__day',
                cell.inMonth ? '' : 'ui-datepicker__day--out',
                isToday ? 'ui-datepicker__day--today' : '',
                isSel ? 'ui-datepicker__day--selected' : '',
              ].filter(Boolean).join(' ')
              return (
                <Button
                  variant="ghost"
                  size="sm"
                  key={toLocalYMD(cell.date)}
                  role="gridcell"
                  className={cls}
                  aria-label={cell.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  aria-selected={isSel}
                  onClick={() => pick(cell.date)}
                >
                  {cell.day}
                </Button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
